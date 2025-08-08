import { GoogleGenerativeAI } from '@google/generative-ai';

interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
}

interface SummarizationResult {
  summary: string;
  tags: string[];
  keyPoints?: string[];
}

class AIService {
  private gemini: GoogleGenerativeAI | null = null;
  private openaiApiKey: string | null = null;

  constructor() {
    // Initialize Gemini if API key is available
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;
    if (geminiApiKey) {
      this.gemini = new GoogleGenerativeAI(geminiApiKey);
    }

    // Store OpenAI API key for Whisper
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribeAudio(audioUrl: string): Promise<TranscriptionResult> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      // Download audio file
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.mp3');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      // Call Whisper API
      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: formData,
      });

      if (!whisperResponse.ok) {
        const error = await whisperResponse.text();
        throw new Error(`Whisper API error: ${error}`);
      }

      const result = await whisperResponse.json();
      
      return {
        text: result.text,
        language: result.language,
        duration: result.duration,
      };
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate summary and tags using Google Gemini 1.5 Flash
   */
  async generateSummaryAndTags(transcript: string, videoTitle?: string): Promise<SummarizationResult> {
    if (!this.gemini) {
      throw new Error('Gemini API not configured');
    }

    try {
      // Use Gemini 1.5 Flash (free tier)
      const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `
        Analyze the following video transcript and provide:
        1. A concise summary (2-3 paragraphs)
        2. 5-10 relevant tags for categorization
        3. 3-5 key points or takeaways

        ${videoTitle ? `Video Title: ${videoTitle}` : ''}
        
        Transcript:
        ${transcript}

        Format your response as JSON with the following structure:
        {
          "summary": "Your summary here",
          "tags": ["tag1", "tag2", ...],
          "keyPoints": ["point1", "point2", ...]
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      try {
        const parsed = JSON.parse(text);
        return {
          summary: parsed.summary || '',
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        };
      } catch (parseError) {
        // Fallback: Extract content even if not properly formatted
        console.warn('Failed to parse Gemini response as JSON, using fallback extraction');
        return {
          summary: text.substring(0, 500),
          tags: this.extractTags(text),
          keyPoints: [],
        };
      }
    } catch (error) {
      console.error('Summarization error:', error);
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper method to extract tags from text
   */
  private extractTags(text: string): string[] {
    // Simple tag extraction - look for common patterns
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    const tagCandidates = words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .filter(word => /^[a-z]+$/.test(word));

    // Get unique tags, limit to 10
    const uniqueTags = [...new Set(tagCandidates)].slice(0, 10);
    
    return uniqueTags;
  }

  /**
   * Process video for AI features (transcription + summarization)
   */
  async processVideo(audioUrl: string, videoTitle?: string): Promise<{
    transcript: string;
    summary: string;
    tags: string[];
  }> {
    // Step 1: Transcribe audio
    const transcription = await this.transcribeAudio(audioUrl);

    // Step 2: Generate summary and tags
    const summarization = await this.generateSummaryAndTags(transcription.text, videoTitle);

    return {
      transcript: transcription.text,
      summary: summarization.summary,
      tags: summarization.tags,
    };
  }
}

export const aiService = new AIService();