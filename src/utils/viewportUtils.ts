import { Platform } from 'react-native';

export const preventViewportZoom = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      // Prevent zooming by setting maximum-scale and user-scalable
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
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
      // Force reset zoom to 1.0
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      setTimeout(() => {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }, 100);
    }
  }
};