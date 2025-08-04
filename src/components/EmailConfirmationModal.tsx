import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Mail } from 'lucide-react-native';
import { getInterFontConfig } from '../utils/fontUtils';

interface EmailConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  email: string;
}

export function EmailConfirmationModal({ visible, onClose, email }: EmailConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Mail size={48} color="#007AFF" />
          </View>
          
          <Text style={styles.title}>Check your email</Text>
          
          <Text style={styles.subtitle}>
            We've sent a confirmation link to:
          </Text>
          
          <Text style={styles.email}>{email}</Text>
          
          <Text style={styles.instructions}>
            Click the link in the email to confirm your account and get started with VideoAI.
          </Text>
          
          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: isSmallScreen ? 24 : 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: isSmallScreen ? 24 : 28,
    fontWeight: 'bold',
    ...getInterFontConfig('300'),
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 15,
    ...getInterFontConfig('200'),
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  instructions: {
    fontSize: isSmallScreen ? 14 : 15,
    ...getInterFontConfig('200'),
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
  },
});