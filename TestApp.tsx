import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { supabase } from './src/services/supabase';

export default function TestApp() {
  const [user, setUser] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState({
    envVars: false,
    database: false,
    storage: false,
    auth: false,
  });
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    runFullDiagnostics();
  }, []);

  const logError = (error: any, context: string) => {
    const errorMsg = `${context}: ${error?.message || error}`;
    console.error('❌', errorMsg);
    setErrors(prev => [...prev, errorMsg]);
  };

  const runFullDiagnostics = async () => {
    console.log('🔍 Running full diagnostics...');
    setErrors([]);
    
    // Test 1: Environment Variables
    console.log('1️⃣ Checking environment variables...');
    const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!envUrl || !envKey) {
      logError('Missing environment variables', 'ENV CHECK');
      console.log('Current env:', { envUrl, envKey: envKey ? 'SET' : 'MISSING' });
    } else {
      console.log('✅ Environment variables found');
      console.log('URL:', envUrl);
      console.log('Key length:', envKey.length);
      setDiagnostics(prev => ({ ...prev, envVars: true }));
    }

    // Test 2: Database Connection
    console.log('2️⃣ Testing database connection...');
    try {
      const { error } = await supabase.from('videos').select('count', { count: 'exact' });
      if (error) {
        logError(error, 'DATABASE CONNECTION');
      } else {
        console.log('✅ Database connected successfully');
        setDiagnostics(prev => ({ ...prev, database: true }));
      }
    } catch (err) {
      logError(err, 'DATABASE TEST');
    }

    // Test 3: Check Table Schema
    console.log('3️⃣ Checking table schema...');
    try {
      const { error } = await supabase
        .from('videos')
        .select('source_type')
        .limit(1);
      
      if (error && error.message.includes('column "source_type" does not exist')) {
        logError('Missing source_type column - run Phase 2 SQL updates', 'SCHEMA CHECK');
      } else {
        console.log('✅ Database schema looks good');
      }
    } catch (err) {
      logError(err, 'SCHEMA CHECK');
    }

    // Test 4: Storage Access (test bucket access instead of listing)
    console.log('4️⃣ Checking storage access...');
    try {
      // Test if we can access videos bucket
      const { data: videoUrl } = supabase.storage
        .from('videos')
        .getPublicUrl('test-file.mp4');
      
      // Test if we can access thumbnails bucket  
      const { data: thumbUrl } = supabase.storage
        .from('thumbnails')
        .getPublicUrl('test-thumb.jpg');
      
      if (videoUrl?.publicUrl && thumbUrl?.publicUrl) {
        console.log('✅ Storage buckets accessible');
        setDiagnostics(prev => ({ ...prev, storage: true }));
      } else {
        logError('Storage buckets not accessible', 'STORAGE ACCESS');
      }
    } catch (err) {
      logError(err, 'STORAGE ACCESS');
    }

    // Test 5: Auth Configuration
    console.log('5️⃣ Checking auth configuration...');
    try {
      await supabase.auth.getSession();
      console.log('✅ Auth service accessible');
      setDiagnostics(prev => ({ ...prev, auth: true }));
    } catch (err) {
      logError(err, 'AUTH CHECK');
    }

    console.log('🔍 Diagnostics complete');
  };

  const testSignUp = async () => {
    const email = `test${Date.now()}@example.com`;
    const password = 'testpassword123';
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert('Sign Up Error', error.message);
    } else {
      Alert.alert('Success', 'Account created! Check email for verification.');
      setUser(data.user);
    }
  };

  const testSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123',
    });

    if (error) {
      Alert.alert('Sign In Error', error.message);
    } else {
      Alert.alert('Success', 'Signed in!');
      setUser(data.user);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>VideoAI Diagnostics</Text>
      
      <View style={styles.diagnosticsSection}>
        <Text style={styles.sectionTitle}>System Status</Text>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusText}>
            Environment: {diagnostics.envVars ? '✅' : '❌'} Variables
          </Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusText}>
            Database: {diagnostics.database ? '✅' : '❌'} Connection
          </Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusText}>
            Storage: {diagnostics.storage ? '✅' : '❌'} Buckets
          </Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusText}>
            Auth: {diagnostics.auth ? '✅' : '❌'} Service
          </Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusText}>
            User: {user ? `✅ ${user.email}` : '❌ Not signed in'}
          </Text>
        </View>
      </View>

      {errors.length > 0 && (
        <View style={styles.errorsSection}>
          <Text style={styles.sectionTitle}>Issues Found</Text>
          {errors.map((error, index) => (
            <Text key={index} style={styles.errorText}>
              • {error}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.buttonsSection}>
        <TouchableOpacity style={styles.button} onPress={runFullDiagnostics}>
          <Text style={styles.buttonText}>🔄 Run Diagnostics</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, !diagnostics.auth && styles.buttonDisabled]} 
          onPress={testSignUp}
          disabled={!diagnostics.auth}
        >
          <Text style={styles.buttonText}>Test Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, !diagnostics.auth && styles.buttonDisabled]} 
          onPress={testSignIn}
          disabled={!diagnostics.auth}
        >
          <Text style={styles.buttonText}>Test Sign In</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.instructionsSection}>
        <Text style={styles.sectionTitle}>Next Steps</Text>
        {!diagnostics.envVars && (
          <Text style={styles.instructionText}>
            1. Check your .env file has correct Supabase URL and key
          </Text>
        )}
        {!diagnostics.database && (
          <Text style={styles.instructionText}>
            2. Run supabase-setup.sql in your Supabase SQL Editor
          </Text>
        )}
        {!diagnostics.storage && (
          <Text style={styles.instructionText}>
            3. Create 'videos' and 'thumbnails' buckets in Supabase Storage
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  diagnosticsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  statusItem: {
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'monospace',
  },
  errorsSection: {
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  errorText: {
    fontSize: 14,
    color: '#FF9999',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  buttonsSection: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  instructionText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    lineHeight: 20,
  },
});