import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { 
  BeforeInstallPromptEvent, 
  isAppInstalled, 
  isIOSSafari, 
  isMobile 
} from '../utils/pwaUtils';

interface PWAInstallPromptProps {
  onInstallSuccess?: () => void;
  onInstallDismiss?: () => void;
}

export function PWAInstallPrompt({ onInstallSuccess, onInstallDismiss }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (isAppInstalled()) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event (Android Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after user has interacted with the app
      setTimeout(() => {
        if (!isAppInstalled()) {
          setShowPrompt(true);
        }
      }, 30000); // Show after 30 seconds
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      onInstallSuccess?.();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For iOS Safari, show instructions after delay
    if (isIOSSafari() && isMobile()) {
      setTimeout(() => {
        if (!isAppInstalled()) {
          setShowIOSInstructions(true);
        }
      }, 45000); // Show after 45 seconds for iOS
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onInstallSuccess]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        onInstallSuccess?.();
      } else {
        console.log('User dismissed the install prompt');
        onInstallDismiss?.();
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    onInstallDismiss?.();
    
    // Don't show again for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // Don't show if already dismissed this session
  if (sessionStorage.getItem('pwa-prompt-dismissed')) {
    return null;
  }

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  // Android Chrome install prompt
  if (showPrompt && deferredPrompt) {
    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDismiss}
      >
        <View style={styles.overlay}>
          <View style={styles.promptContainer}>
            <Text style={styles.title}>Add to Home Screen</Text>
            <Text style={styles.subtitle}>
              Install videoAI for a better experience
            </Text>
            <Text style={styles.description}>
              • Faster loading times{'\n'}
              • Work offline{'\n'}
              • App-like experience{'\n'}
              • No app store required
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.dismissButton} 
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissButtonText}>Not Now</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.installButton} 
                onPress={handleInstallClick}
                activeOpacity={0.8}
              >
                <Text style={styles.installButtonText}>Install App</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // iOS Safari install instructions
  if (showIOSInstructions && isIOSSafari()) {
    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDismiss}
      >
        <View style={styles.overlay}>
          <View style={styles.promptContainer}>
            <Text style={styles.title}>Add to Home Screen</Text>
            <Text style={styles.subtitle}>
              Install videoAI on your iPhone
            </Text>
            
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionStep}>
                1. Tap the share button <Text style={styles.shareIcon}>⬆️</Text> in Safari
              </Text>
              <Text style={styles.instructionStep}>
                2. Scroll down and tap "Add to Home Screen"
              </Text>
              <Text style={styles.instructionStep}>
                3. Tap "Add" to install the app
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.dismissButton} 
              onPress={handleDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return null;
}

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  promptContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: isSmallScreen ? 20 : 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: isSmallScreen ? 14 : 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 24,
  },
  instructionsContainer: {
    marginBottom: 24,
  },
  instructionStep: {
    fontSize: isSmallScreen ? 14 : 15,
    color: '#ccc',
    lineHeight: 24,
    marginBottom: 8,
  },
  shareIcon: {
    fontSize: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  installButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  installButtonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '500',
  },
});