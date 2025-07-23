import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';\nimport { Check, Wifi } from 'lucide-react-native';
import { getNetworkStatus, onNetworkChange } from '../utils/pwaUtils';

interface NetworkStatusProps {
  onNetworkChange?: (isOnline: boolean) => void;
}

export function NetworkStatus({ onNetworkChange: onNetworkChangeCallback }: NetworkStatusProps) {
  const [isOnline, setIsOnline] = useState(getNetworkStatus());
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const slideAnim = new Animated.Value(-100);

  useEffect(() => {
    const cleanup = onNetworkChange((online) => {
      setIsOnline(online);
      onNetworkChangeCallback?.(online);
      
      if (!online) {
        setShowOfflineMessage(true);
        // Slide down the offline message
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      } else if (showOfflineMessage) {
        // Connection restored - slide up and hide after delay
        setTimeout(() => {
          Animated.spring(slideAnim, {
            toValue: -100,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start(() => {
            setShowOfflineMessage(false);
          });
        }, 2000); // Show "back online" for 2 seconds
      }
    });

    return cleanup;
  }, [showOfflineMessage, slideAnim, onNetworkChangeCallback]);

  if (!showOfflineMessage) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: isOnline ? '#34C759' : '#FF3B30',
        }
      ]}
    >
      <View style={styles.content}>
        <View style={styles.icon}>
          {isOnline ? (
            <Check size={20} color="#4CAF50" />
          ) : (
            <Wifi size={20} color="#FF9500" />
          )}
        </View>
        <Text style={styles.message}>
          {isOnline 
            ? 'Back online! All features restored.' 
            : 'You\'re offline. Some features may be limited.'
          }
        </Text>
      </View>
    </Animated.View>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 50, // Account for status bar
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: '#fff',
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
});