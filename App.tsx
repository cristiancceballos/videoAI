import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Uncomment this line to test basic Supabase connection
import TestApp from './TestApp';

import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { PWAInstallPrompt } from './src/components/PWAInstallPrompt';
import { NetworkStatus } from './src/components/NetworkStatus';
import { registerServiceWorker } from './src/utils/pwaUtils';

export default function App() {
  useEffect(() => {
    // Register service worker for PWA functionality (web only)
    if (Platform.OS === 'web') {
      registerServiceWorker();
    }
  }, []);

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
