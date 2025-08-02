import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getInterFontConfig, getInterFontConfigForInputs } from '../../utils/fontUtils';

export function SignUpScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp } = useAuth();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Success',
        'Account created! Please check your email to verify your account.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Create a password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#666" />
                  ) : (
                    <Eye size={20} color="#666" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#666"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  activeOpacity={0.7}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color="#666" />
                  ) : (
                    <Eye size={20} color="#666" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => Alert.alert('Info', 'Google sign-up coming soon')}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: 'https://www.google.com/favicon.ico' }}
              style={styles.googleIcon}
            />
            <Text style={styles.googleButtonText}>Sign up with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkTextBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isVerySmallScreen = screenWidth < 320;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: isSmallScreen ? 24 : 40,
    paddingVertical: 40,
    minHeight: screenHeight * 0.9,
  },
  form: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 60,
  },
  title: {
    fontSize: isVerySmallScreen ? 24 : isSmallScreen ? 28 : 32,
    fontWeight: 'bold',
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
    color: '#fff',
    textAlign: 'left',
  },
  inputContainer: {
    marginBottom: 40,
  },
  inputWrapper: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: isSmallScreen ? 13 : 14,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic
    color: '#ccc',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: isSmallScreen ? 14 : 16,
    fontSize: isSmallScreen ? 15 : 16,
    ...getInterFontConfigForInputs('200'), // Regular Inter for better input readability
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 48,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: isSmallScreen ? 14 : 16,
    alignItems: 'center',
    marginBottom: 40,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    fontSize: isSmallScreen ? 12 : 13,
    ...getInterFontConfig('200'),
    color: '#666',
    paddingHorizontal: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: isSmallScreen ? 14 : 16,
    marginBottom: 24,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#333',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: isSmallScreen ? 15 : 16,
    ...getInterFontConfig('300'),
    color: '#fff',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    color: '#888',
    fontSize: isSmallScreen ? 13 : 14,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium -0.75 letterSpacing
    textAlign: 'center',
  },
  linkTextBold: {
    color: '#007AFF',
    fontWeight: '500',
  },
});