import { Platform } from 'react-native';

export const preventViewportZoom = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      // Prevent zooming by setting maximum-scale and user-scalable=0 (more reliable than 'no')
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=0');
    }
    
    // Also prevent double-tap zoom
    const style = document.createElement('style');
    style.innerHTML = `
      input, textarea {
        touch-action: manipulation;
      }
    `;
    document.head.appendChild(style);
  }
};

export const allowViewportZoom = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      // Re-enable zooming
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }
  }
};

export const resetViewportZoom = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      // Force reset zoom to 1.0 and then re-enable normal behavior
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=0');
      
      // Use requestAnimationFrame for smoother transition
      requestAnimationFrame(() => {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      });
    }
  }
};