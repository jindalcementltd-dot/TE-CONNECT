import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { login } from '../../src/services/auth';
import { apiGetSettings } from '../../src/services/api';
import Toast from 'react-native-toast-message';

export default function LoginScreen() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    checkServer();
  }, []);

  const checkServer = async () => {
    setServerStatus('checking');
    try {
      const res = await apiGetSettings();
      if (res && res.length > 0) {
        setServerStatus('connected');
      } else {
        setServerStatus('error');
      }
    } catch {
      setServerStatus('error');
    }
  };

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: 'Login Failed', text2: 'Please enter login ID and password.' });
      return;
    }
    setLoading(true);
    try {
      await login(loginId.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: err.message || 'Invalid credentials. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header / Brand */}
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🏗️</Text>
          </View>
          <Text style={styles.appName}>TE CONNECT</Text>
          <Text style={styles.appTagline}>Field Management System</Text>
          
          <TouchableOpacity onPress={checkServer} style={styles.teamBadge}>
            {serverStatus === 'checking' && <Text style={styles.teamBadgeText}>🔄 Checking Connection...</Text>}
            {serverStatus === 'connected' && <Text style={styles.teamBadgeText}>🟢 API Connected</Text>}
            {serverStatus === 'error' && <Text style={styles.teamBadgeText}>🔴 API Disconnected</Text>}
          </TouchableOpacity>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSubtitle}>Sign in to continue</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Login ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your login ID"
              placeholderTextColor={Colors.textMuted}
              value={loginId}
              onChangeText={setLoginId}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Contact your manager if you cannot login.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>TE CONNECT v1.0</Text>
          <Text style={styles.footerSub}>Jajpur Territory · ACC Cement</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 2,
  },
  appTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    letterSpacing: 1,
  },
  teamBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  teamBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 13,
  },
  eyeIcon: {
    fontSize: 18,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  helpText: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  footerSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 2,
  },
});
