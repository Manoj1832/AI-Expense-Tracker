import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabaseClient';
import LoginScreen from '../screens/LoginScreen';

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<'checking' | 'authed' | 'login' | 'biometric_failed'>('checking');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      // 1. Check if we have a stored session token
      const sessionString = await SecureStore.getItemAsync('supabase.auth.token');
      if (!sessionString) {
        setState('login');
        return;
      }

      // 2. Check if biometric hardware is available
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        triggerBiometric();
      } else {
        // Fallback silently to standard refresh if biometrics not enrolled
        attemptSilentRefresh();
      }
    } catch (e) {
      console.error(e);
      setState('login');
    }
  }

  async function triggerBiometric() {
    try {
      setState('checking');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock AI Expense Tracker',
        fallbackLabel: 'Enter Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await attemptSilentRefresh();
      } else {
        setState('biometric_failed');
      }
    } catch (e) {
      setErrorMessage('Biometric verification error');
      setState('biometric_failed');
    }
  }

  async function attemptSilentRefresh() {
    try {
      // Supabase storage adapter manages reading token automatically, we just trigger refresh
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        // If current session invalid, try fetching refresh token directly
        const stored = await SecureStore.getItemAsync('supabase.auth.token');
        if (stored) {
          const parsed = JSON.parse(stored);
          const refreshToken = parsed?.currentSession?.refresh_token;
          if (refreshToken) {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
              refresh_token: refreshToken,
            });
            if (refreshError || !refreshData.session) {
              setState('login');
              return;
            }
            setState('authed');
            return;
          }
        }
        setState('login');
        return;
      }

      // Proactively rotate/refresh standard session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        setState('login');
        return;
      }

      setState('authed');
    } catch (e) {
      setState('login');
    }
  }

  if (state === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF7A00" />
        <Text style={styles.loadingText}>Unlocking securely...</Text>
      </View>
    );
  }

  if (state === 'biometric_failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>App is Locked</Text>
        <Text style={styles.subText}>{errorMessage || 'Biometric authentication failed.'}</Text>
        <TouchableOpacity style={styles.button} onPress={triggerBiometric}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textLink} onPress={() => setState('login')}>
          <Text style={styles.linkText}>Use Password</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state === 'login') {
    return <LoginScreen onSuccess={() => setState('authed')} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: '#E2E2E9',
    fontSize: 16,
  },
  errorText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF4D4D',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#8E8E9F',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#FF7A00',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    maxWidth: 240,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  textLink: {
    padding: 8,
  },
  linkText: {
    color: '#FF7A00',
    fontSize: 14,
    fontWeight: '500',
  },
});
