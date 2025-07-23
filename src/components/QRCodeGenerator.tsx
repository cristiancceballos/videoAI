import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';\nimport { Lightbulb, Smartphone } from 'lucide-react-native';

interface QRCodeGeneratorProps {
  appUrl?: string;
  onUrlChange?: (url: string) => void;
}

export function QRCodeGenerator({ appUrl = '', onUrlChange }: QRCodeGeneratorProps) {
  const [url, setUrl] = useState(appUrl);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    if (url && Platform.OS === 'web') {
      generateQRCode(url);
    }
  }, [url]);

  const generateQRCode = async (urlToEncode: string) => {
    if (Platform.OS !== 'web') return;
    
    try {
      // Use QRCode.js library dynamically
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      script.onload = () => {
        const canvas = document.createElement('canvas');
        (window as any).QRCode.toCanvas(canvas, urlToEncode, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        }, (error: any) => {
          if (error) {
            console.error('QR Code generation failed:', error);
            return;
          }
          setQrCodeDataUrl(canvas.toDataURL());
        });
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    onUrlChange?.(newUrl);
  };

  const handleGenerateClick = () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }
    
    generateQRCode(url);
  };

  const handleDownloadQR = () => {
    if (Platform.OS !== 'web' || !qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.download = 'growth-of-wisdom-qr-code.png';
    link.href = qrCodeDataUrl;
    link.click();
  };

  const copyToClipboard = async () => {
    if (Platform.OS !== 'web') return;
    
    try {
      await navigator.clipboard.writeText(url);
      Alert.alert('Success', 'URL copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      Alert.alert('Error', 'Failed to copy URL');
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>QR Code Generator</Text>
        <Text style={styles.subtitle}>
          QR code generation is only available on web platform
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code Generator</Text>
      <Text style={styles.subtitle}>
        Generate QR codes for easy app distribution
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>App URL:</Text>
        <TextInput
          style={styles.input}
          placeholder="https://your-app-name.vercel.app"
          placeholderTextColor="#666"
          value={url}
          onChangeText={handleUrlChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.generateButton} 
            onPress={handleGenerateClick}
            activeOpacity={0.8}
          >
            <Text style={styles.generateButtonText}>Generate QR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.copyButton} 
            onPress={copyToClipboard}
            activeOpacity={0.8}
          >
            <Text style={styles.copyButtonText}>Copy URL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {qrCodeDataUrl && (
        <View style={styles.qrContainer}>
          <img 
            src={qrCodeDataUrl} 
            alt="QR Code" 
            style={styles.qrImage}
          />
          
          <TouchableOpacity 
            style={styles.downloadButton} 
            onPress={handleDownloadQR}
            activeOpacity={0.8}
          >
            <Text style={styles.downloadButtonText}>Download QR Code</Text>
          </TouchableOpacity>
          
          <Text style={styles.instructions}>
            <View style={styles.tipIcon}><Lightbulb size={16} color="#FFA500" /></View> Users can scan this QR code to install your PWA
          </Text>
        </View>
      )}

      <View style={styles.tips}>
        <View style={styles.tipsTitle}>
          <Smartphone size={18} color="#007AFF" />
          <Text style={styles.tipsTitleText}> Distribution Tips:</Text>
        </View>
        <Text style={styles.tipText}>• Print QR codes at least 2cm x 2cm</Text>
        <Text style={styles.tipText}>• Use high contrast (black on white)</Text>
        <Text style={styles.tipText}>• Test scanning before distributing</Text>
        <Text style={styles.tipText}>• Include simple installation instructions</Text>
      </View>
    </View>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: isSmallScreen ? 16 : 20,
    backgroundColor: '#000',
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#888',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: isSmallScreen ? 14 : 16,
    fontSize: isSmallScreen ? 15 : 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  generateButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
  },
  copyButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '500',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  qrImage: {
    width: 250,
    height: 250,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
  },
  downloadButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 12,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
  },
  instructions: {
    fontSize: isSmallScreen ? 13 : 14,
    color: '#888',
    textAlign: 'center',
  },
  tips: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tipsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipsTitleText: {
    fontSize: isSmallScreen ? 15 : 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
  },
  tipIcon: {
    marginRight: 6,
    alignItems: 'center',
  },
  tipText: {
    fontSize: isSmallScreen ? 13 : 14,
    color: '#ccc',
    marginBottom: 6,
    lineHeight: 20,
  },
});