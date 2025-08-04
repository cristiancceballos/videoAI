import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getInterFontConfig } from '../../utils/fontUtils';
import { supabase } from '../../services/supabase';

export function EmailConfirmationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    // Check if we have a hash with tokens (from email confirmation)
    const verifyEmail = async () => {
      try {
        // In a web environment, we would parse the URL hash
        // The tokens are automatically handled by Supabase when the user clicks the link
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setVerified(true);
        }
      } catch (error) {
        console.error('Error verifying email:', error);
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
  }, []);

  const handleGoToDashboard = () => {
    // This will navigate to the main app since user should be authenticated
    // The AppNavigator will handle showing MainTabs for authenticated users
    navigation.navigate('Home' as never);
  };

  if (verifying) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.verifyingText}>Verifying your email...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{`Thank you <3`}</Text>
        <Text style={styles.subtitle}>Your email has been confirmed.</Text>
        
        <TouchableOpacity
          style={styles.button}
          onPress={handleGoToDashboard}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Go to VideoAI</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: isSmallScreen ? 24 : 40,
    paddingVertical: 40,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  title: {
    fontSize: isSmallScreen ? 40 : 48,
    fontWeight: 'bold',
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
    color: '#fff',
    textAlign: 'left',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: isSmallScreen ? 18 : 20,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic
    color: '#ccc',
    textAlign: 'left',
    marginBottom: 48,
    lineHeight: 28,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: isSmallScreen ? 14 : 16,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
  },
  verifyingText: {
    fontSize: isSmallScreen ? 16 : 18,
    ...getInterFontConfig('200'),
    color: '#ccc',
    marginTop: 16,
  },
});