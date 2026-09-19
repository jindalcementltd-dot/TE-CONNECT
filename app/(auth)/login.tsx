import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { login } from '../../src/services/auth';
import { apiGetSettings } from '../../src/services/api';
import Toast from 'react-native-toast-message';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
        {/* Header / Brand with Wine Gradient & Glow */}
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoInner}>
              <MaterialCommunityIcons name="shield-crown-outline" size={44} color="#FFFFFF" />
            </View>
          </View>
          
          <View style={styles.brandTitleRow}>
            <Text style={styles.appNameTE}>TE </Text>
            <Text style={styles.appNameCONNECT}>CONNECT</Text>
          </View>
          
          <Text style={styles.appTagline}>Field Command & Intelligence System</Text>
          
          {/* Server Connection Status Badge */}
          <TouchableOpacity onPress={checkServer} style={styles.teamBadge} activeOpacity={0.8}>
            {serverStatus === 'checking' && (
              <View style={styles.badgeRow}>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.teamBadgeText}>Connecting to Google Sheet...</Text>
              </View>
            )}
            {serverStatus === 'connected' && (
              <View style={styles.badgeRow}>
                <View style={styles.greenDot} />
                <Text style={styles.teamBadgeText}>Google Sheet API Connected</Text>
              </View>
            )}
            {serverStatus === 'error' && (
              <View style={styles.badgeRow}>
                <View style={styles.redDot} />
                <Text style={styles.teamBadgeText}>API Disconnected (Tap to Retry)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Enter your credentials to access Team Jajpur workspace</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Login ID</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={18} color="#8A7277" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. admin"
                placeholderTextColor="#A0858C"
                value={loginId}
                onChangeText={setLoginId}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color="#8A7277" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 40 }]}
                placeholder="Enter password"
                placeholderTextColor="#A0858C"
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
                <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#8A7277" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContentRow}>
                <Text style={styles.loginBtnText}>Sign In</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.helpBox}>
            <Text style={styles.helpText}>
              Default Login ID: <Text style={styles.boldText}>admin</Text> | Password: <Text style={styles.boldText}>123</Text>
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>TE CONNECT • TEAM JAJPUR</Text>
          <Text style={styles.footerSub}>ACC Cement Field Management • v1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { FontFamily } from '../../src/theme/typography';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A0611', // Luxury deep wine
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: '#800E20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appNameTE: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  appNameCONNECT: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 32,
    fontWeight: '900',
    color: '#E53935',
    letterSpacing: 1,
  },
  appTagline: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  teamBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  teamBadgeText: {
    fontFamily: FontFamily.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
  cardTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 24,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: '#6B4E55',
    marginBottom: 20,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#1F0B10',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 16,
    backgroundColor: '#FAF6F7',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    fontFamily: FontFamily.sansMedium,
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F0B10',
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 4,
  },
  loginBtn: {
    backgroundColor: '#800E20',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    fontFamily: FontFamily.displayBold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  helpBox: {
    backgroundColor: '#FAF0F2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#F0D5DA',
  },
  helpText: {
    fontFamily: FontFamily.sansRegular,
    textAlign: 'center',
    color: '#6B4E55',
    fontSize: 11,
    fontWeight: '500',
  },
  boldText: {
    fontFamily: FontFamily.sansBold,
    fontWeight: '800',
    color: '#800E20',
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontFamily: FontFamily.sansBold,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footerSub: {
    fontFamily: FontFamily.sansRegular,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    marginTop: 2,
  },
});
