interface ThumbnailValidationResult {
  isValid: boolean;
  shouldRetry: boolean;
  error?: string;
}

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 5,
  initialDelay: 3000, // Start checking after 3 seconds
  maxDelay: 30000,   // Max 30 seconds between retries
  backoffMultiplier: 1.5
};

/**
 * Validates if a thumbnail URL returns a valid image (not black/placeholder)
 * Uses a simple HEAD request to check if the image exists
 */
export async function validateThumbnail(url: string): Promise<ThumbnailValidationResult> {
  try {
    // For Cloudinary URLs, we can check if the transformation has been processed
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'cors'
    });

    if (response.ok && response.status === 200) {
      // Check content type to ensure it's an image
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        return { isValid: true, shouldRetry: false };
      }
    }

    // 404 or other error - thumbnail not ready yet
    if (response.status === 404) {
      return { isValid: false, shouldRetry: true, error: 'Thumbnail not found' };
    }

    return { 
      isValid: false, 
      shouldRetry: response.status >= 500, // Retry on server errors
      error: `HTTP ${response.status}` 
    };
  } catch (error) {
    // Network error or CORS issue - we'll assume the image might be valid
    // but blocked by CORS, so we'll return valid to avoid infinite retries
    return { isValid: true, shouldRetry: false };
  }
}

/**
 * Waits for a thumbnail to become available with exponential backoff
 */
export async function waitForThumbnail(
  url: string, 
  options: RetryOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let delay = opts.initialDelay!;
  
  for (let attempt = 0; attempt < opts.maxRetries!; attempt++) {
    // Wait before checking (except on first attempt if delay is 0)
    if (attempt > 0 || delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const result = await validateThumbnail(url);
    
    if (result.isValid) {
      return true;
    }

    if (!result.shouldRetry) {
      return false;
    }

    // Calculate next delay with exponential backoff
    delay = Math.min(delay * opts.backoffMultiplier!, opts.maxDelay!);
  }

  return false;
}

/**
 * React hook for thumbnail validation with retry
 */
import { useState, useEffect, useRef } from 'react';

export function useThumbnailValidation(
  thumbnailUrl: string | undefined,
  options: RetryOptions = {}
) {
  const [isValidated, setIsValidated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!thumbnailUrl || isValidated) {
      return;
    }

    let cancelled = false;

    const validate = async () => {
      setIsValidating(true);
      setError(null);

      try {
        const isValid = await waitForThumbnail(thumbnailUrl, options);
        
        if (!cancelled && isMounted.current) {
          setIsValidated(isValid);
          if (!isValid) {
            setError('Thumbnail validation failed');
          }
        }
      } catch (err) {
        if (!cancelled && isMounted.current) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled && isMounted.current) {
          setIsValidating(false);
        }
      }
    };

    validate();

    return () => {
      cancelled = true;
    };
  }, [thumbnailUrl, isValidated]);

  return {
    isValidated,
    isValidating,
    error,
    retry: () => {
      setIsValidated(false);
      setError(null);
    }
  };
}