import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { login } from '../../src/services/auth';
import { apiGetSettings } from '../../src/services/api';
import Toast from 'react-native-toast-message';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => { checkServer(); }, []);

  const checkServer = async () => {
    setServerStatus('checking');
    try {
      const res = await apiGetSettings();
      if (res && res.length > 0) setServerStatus('connected');
      else setServerStatus('error');
    } catch { setServerStatus('error'); }
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
      Toast.show({ type: 'error', text1: 'Login Failed', text2: err.message || 'Invalid credentials. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/app-logo.jpg')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          
          <View style={styles.brandTitleRow}>
            <Text style={styles.appNameTE}>TE </Text>
            <Text style={styles.appNameCONNECT}>CONNECT</Text>
          </View>
          
          <Text style={styles.appTagline}>Field Command & Intelligence System</Text>
          
          <TouchableOpacity onPress={checkServer} style={styles.teamBadge} activeOpacity={0.8}>
            {serverStatus === 'checking' && (
              <View style={styles.badgeRow}>
                <ActivityIndicator size="small" color={Colors.white} style={{ marginRight: 6 }} />
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Enter your credentials to access Team Jajpur workspace</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Login ID</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="e.g. admin" placeholderTextColor={Colors.textMuted} value={loginId} onChangeText={setLoginId} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput style={[styles.input, { paddingRight: 40 }]} placeholder="Enter password" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} returnKeyType="done" onSubmitEditing={handleLogin} />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye" : "eye-off"} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.loginBtn, loading && styles.loginBtnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.88}>
            {loading ? <ActivityIndicator color={Colors.white} size="small" /> : (
              <View style={styles.btnContentRow}>
                <Text style={styles.loginBtnText}>Sign In</Text>
                <Feather name="arrow-right" size={18} color={Colors.white} style={{ marginLeft: 6 }} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.helpBox}>
            <Text style={styles.helpText}>Default Login ID: <Text style={styles.boldText}>admin</Text> | Password: <Text style={styles.boldText}>123</Text></Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>TE CONNECT • TEAM JAJPUR</Text>
          <Text style={styles.footerSub}>ACC Cement Field Management • v1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryDark },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: 40 },
  brandSection: { alignItems: 'center', marginBottom: Spacing.xl },
  logoContainer: { width: 96, height: 96, borderRadius: BorderRadius['2xl'], backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.base, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, overflow: 'hidden' },
  logoImage: { width: 92, height: 92, borderRadius: BorderRadius.xl },
  brandTitleRow: { flexDirection: 'row', alignItems: 'center' },
  appNameTE: { fontFamily: FontFamily.displayBlack, fontSize: FontSize['4xl'], color: Colors.white, letterSpacing: 1 },
  appNameCONNECT: { fontFamily: FontFamily.displayBlack, fontSize: FontSize['4xl'], color: Colors.primaryLight, letterSpacing: 1 },
  appTagline: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: 'rgba(255, 255, 255, 0.75)', marginTop: 4, letterSpacing: 0.5 },
  teamBadge: { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, marginTop: Spacing.md, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, marginRight: 6 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error, marginRight: 6 },
  teamBadgeText: { fontFamily: FontFamily.sansSemiBold, color: Colors.white, fontSize: 12, letterSpacing: 0.5 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, shadowColor: 'rgba(0, 0, 0, 0.3)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 24, elevation: 12 },
  cardTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize['2xl'], color: Colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontFamily: FontFamily.sansRegular, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 18 },
  inputGroup: { marginBottom: Spacing.base },
  inputLabel: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: Spacing.xs },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, backgroundColor: Colors.background, paddingHorizontal: Spacing.md },
  inputIcon: { marginRight: 10 },
  input: { fontFamily: FontFamily.sansMedium, flex: 1, paddingVertical: 14, fontSize: FontSize.base, color: Colors.textPrimary },
  eyeBtn: { padding: 4 },
  loginBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: Spacing.base, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  loginBtnDisabled: { opacity: 0.7 },
  btnContentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { fontFamily: FontFamily.displayBold, color: Colors.white, fontSize: FontSize.md, letterSpacing: 0.5 },
  helpBox: { backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.md, paddingVertical: 10, paddingHorizontal: 12, marginTop: Spacing.lg, borderWidth: 1, borderColor: Colors.borderLight },
  helpText: { fontFamily: FontFamily.sansRegular, textAlign: 'center', color: Colors.textSecondary, fontSize: 11 },
  boldText: { fontFamily: FontFamily.sansBold, color: Colors.primary },
  footer: { alignItems: 'center', marginTop: Spacing['2xl'] },
  footerText: { fontFamily: FontFamily.sansBold, color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, letterSpacing: 1 },
  footerSub: { fontFamily: FontFamily.sansRegular, color: 'rgba(255, 255, 255, 0.45)', fontSize: 10, marginTop: 2 },
});
