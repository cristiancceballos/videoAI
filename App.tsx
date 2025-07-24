import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { 
  useFonts, 
  Inter_200ExtraLight, 
  Inter_200ExtraLight_Italic,
  Inter_300Light,
  Inter_300Light_Italic,
  Inter_400Regular 
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-url-polyfill/auto';

// Polyfill for structuredClone (not available in older mobile browsers)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Uncomment this line to test basic Supabase connection
import TestApp from './TestApp';

import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { PWAInstallPrompt } from './src/components/PWAInstallPrompt';
import { NetworkStatus } from './src/components/NetworkStatus';
import { registerServiceWorker } from './src/utils/pwaUtils';

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function App() {
  // Load Inter fonts - focusing on lighter weights for elegant mobile typography
  const [fontsLoaded] = useFonts({
    Inter_200ExtraLight,
    Inter_200ExtraLight_Italic,
    Inter_300Light,
    Inter_300Light_Italic,
    Inter_400Regular, // Keep as fallback
  });

  useEffect(() => {
    // Register service worker for PWA functionality (web only)
    if (Platform.OS === 'web') {
      registerServiceWorker();
    }
  }, []);

  useEffect(() => {
    // Hide splash screen when fonts are loaded
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Show loading screen while fonts are loading
  if (!fontsLoaded) {
    return null;
  }

  const handleInstallSuccess = () => {
    console.log('PWA installed successfully!');
  };

  const handleInstallDismiss = () => {
    console.log('PWA install prompt dismissed');
  };

  const handleNetworkChange = (isOnline: boolean) => {
    console.log('Network status changed:', isOnline ? 'online' : 'offline');
  };

  // Switch back to main app - diagnostics passed!
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="light" />
      
      {/* PWA-specific components (web only) */}
      {Platform.OS === 'web' && (
        <>
          <NetworkStatus onNetworkChange={handleNetworkChange} />
          <PWAInstallPrompt 
            onInstallSuccess={handleInstallSuccess}
            onInstallDismiss={handleInstallDismiss}
          />
        </>
      )}
    </AuthProvider>
  );
  
  // TestApp available if needed for debugging
  // return <TestApp />;
}
