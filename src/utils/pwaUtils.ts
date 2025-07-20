// PWA utility functions for service worker and installation
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Register service worker
export const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available, refresh page
              console.log('New content available, reloading...');
              window.location.reload();
            }
          });
        }
      });
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

// Check if app is installed
export const isAppInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true;
};

// Check if device supports PWA installation
export const canInstallPWA = (): boolean => {
  return 'serviceWorker' in navigator && 
         'BeforeInstallPromptEvent' in window;
};

// Detect iOS Safari
export const isIOSSafari = (): boolean => {
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const safari = /Safari/.test(ua);
  return iOS && webkit && safari && !(window.navigator as any).standalone;
};

// Detect if device is mobile
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// Network status detection
export const getNetworkStatus = (): boolean => {
  return navigator.onLine;
};

// Listen for network changes
export const onNetworkChange = (callback: (isOnline: boolean) => void): (() => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// Local storage helpers for offline data
export const setOfflineData = (key: string, data: any): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`offline_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    }
  } catch (error) {
    console.warn('Failed to save offline data:', error);
  }
};

export const getOfflineData = (key: string, maxAge = 24 * 60 * 60 * 1000): any => {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    
    const stored = localStorage.getItem(`offline_${key}`);
    if (!stored) return null;
    
    const { data, timestamp } = JSON.parse(stored);
    if (Date.now() - timestamp > maxAge) {
      localStorage.removeItem(`offline_${key}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Failed to retrieve offline data:', error);
    return null;
  }
};

export const clearOfflineData = (key: string): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`offline_${key}`);
    }
  } catch (error) {
    console.warn('Failed to clear offline data:', error);
  }
};