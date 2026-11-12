import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { isMobile } from '../utils/pwaUtils';
import { getInterFontConfig } from '../utils/fontUtils';

export function DesktopBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && !isMobile()) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <View style={styles.iconRow}>
            <Smartphone size={22} color="#007AFF" />
            <Text style={styles.message}>Designed for your phone</Text>
          </View>
          <Text style={styles.subtext}>Scan and upload your favorite videos</Text>
        </View>

        <View style={styles.qrContainer}>
          <Image
            source={require('../../assets/VideoAI-qr-code.png')}
            style={styles.qrCode}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  message: {
    fontSize: 18,
    color: '#fff',
    marginLeft: 12,
    ...getInterFontConfig('300'),
  },
  subtext: {
    fontSize: 15,
    color: '#888',
    marginLeft: 34,
    marginTop: 4,
    ...getInterFontConfig('200'),
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
  },
  qrCode: {
    width: 100,
    height: 100,
  },
});
