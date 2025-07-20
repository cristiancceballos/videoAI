// Web-compatible storage that works on mobile browsers
class WebStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      // Try localStorage first (works on most browsers)
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key);
      }
      
      // Fallback to sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return sessionStorage.getItem(key);
      }
      
      return null;
    } catch (error) {
      console.warn('Storage getItem failed:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Try localStorage first
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
        return;
      }
      
      // Fallback to sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(key, value);
        return;
      }
    } catch (error) {
      console.warn('Storage setItem failed:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
      
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Storage removeItem failed:', error);
    }
  }
}

export const webStorage = new WebStorage();