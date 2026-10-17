import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { Colors } from '../src/theme/colors';
import { Spacing, BorderRadius } from '../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../src/theme/typography';
import { getUser, logout } from '../src/services/auth';
import { apiChangePassword } from '../src/services/api';
import { addNotification } from '../src/services/notifications';
import { User } from '../src/types';
import { APP_VERSION } from '../src/config/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 6) {
      Toast.show({ type: 'error', text1: 'Too Short', text2: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Mismatch', text2: 'New passwords do not match.' });
      return;
    }

    setChangingPassword(true);
    try {
      const oldHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        currentPassword.trim()
      );
      const newHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        newPassword.trim()
      );

      const res = await apiChangePassword({
        user_id: user?.user_id || '',
        old_password_hash: oldHash,
        new_password_hash: newHash,
      });

      if (res.success) {
        Toast.show({ type: 'success', text1: 'Password Updated! ✅', text2: 'Your password was changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await addNotification(
          '🔒 Password Changed',
          'Your account password has been updated successfully.',
          'SYSTEM'
        );
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message || 'Incorrect current password.' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message || 'Failed to update password.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out from TE CONNECT?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Profile</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutHeaderBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* User Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Rehan')}&background=FFFFFF&color=C91F2B&size=160&bold=true` }}
              style={styles.avatarImg}
            />
            <View style={styles.verifiedOnlineDot} />
          </View>
          <Text style={styles.heroName}>{user?.name || 'User'}</Text>
          <Text style={styles.heroLoginId}>@{user?.login_id || 'login'}</Text>

          <View style={styles.roleBadgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user?.role || 'TE'}</Text>
            </View>
            <View style={styles.activePill}>
              <View style={styles.greenDot} />
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* User Details Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <InfoRow icon="shield-account-outline" label="Designation / Role" value={user?.role || 'Technical Engineer'} />
          <InfoRow icon="account-group-outline" label="Team" value={user?.team || 'Team Jajpur'} />
          <InfoRow icon="map-marker-radius-outline" label="Territory" value={`${user?.territory || 'Jajpur'} Territory`} />
          <InfoRow icon="city-variant-outline" label="District" value={user?.district || 'Jajpur'} />
          <InfoRow icon="phone-outline" label="Registered Mobile" value={user?.phone || 'Not configured'} />
        </View>

        {/* Change Password Card */}
        <View style={styles.sectionCard}>
          <View style={styles.passHeaderRow}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Change Password</Text>
          </View>

          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.passInputWrap}>
              <TextInput
                style={styles.passInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showCurrentPass}
              />
              <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)} style={styles.eyeBtn}>
                <Ionicons name={showCurrentPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password (Min 6 chars)</Text>
            <View style={styles.passInputWrap}>
              <TextInput
                style={styles.passInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showNewPass}
              />
              <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)} style={styles.eyeBtn}>
                <Ionicons name={showNewPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={styles.passInputWrap}>
              <TextInput
                style={styles.passInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showNewPass}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.savePassBtn, changingPassword && styles.disabledBtn]}
            onPress={handleChangePassword}
            disabled={changingPassword}
            activeOpacity={0.85}
          >
            {changingPassword ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.savePassText}>Update Password 🔒</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* App Info Card */}
        <View style={styles.appInfoCard}>
          <Image
            source={require('../assets/images/app-logo.jpg')}
            style={styles.appInfoLogo}
            resizeMode="contain"
          />
          <Text style={styles.appInfoTitle}>TE CONNECT</Text>
          <Text style={styles.appInfoSub}>Adani ACC Cement · Version {APP_VERSION}</Text>
          <Text style={styles.appInfoTerritory}>Technical Engineering Platform · Jajpur & Bhadrak</Text>
        </View>

        {/* Logout Action Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Logout from App</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconBox}>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing['2xl'],
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40 },
  logoutHeaderBtn: { width: 40, alignItems: 'flex-end' },
  headerTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.base },

  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarWrap: { position: 'relative', marginBottom: Spacing.md },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF' },
  verifiedOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroName: { fontFamily: FontFamily.displayBold, fontSize: 22, color: Colors.white },
  heroLoginId: { fontFamily: FontFamily.sansMedium, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  roleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.md },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  roleBadgeText: { fontFamily: FontFamily.sansBold, fontSize: 11, color: Colors.white, letterSpacing: 0.5 },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  activeText: { fontFamily: FontFamily.sansBold, fontSize: 10, color: '#166534' },

  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontFamily: FontFamily.displayBold, fontSize: 15, color: Colors.textPrimary, marginBottom: Spacing.md },
  passHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontFamily: FontFamily.sansSemiBold, fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  passInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
  },
  passInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.textPrimary },
  eyeBtn: { padding: 6 },

  savePassBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: 6,
  },
  disabledBtn: { opacity: 0.6 },
  savePassText: { fontFamily: FontFamily.sansBold, fontSize: 14, color: Colors.white },

  appInfoCard: {
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  appInfoLogo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    marginBottom: 8,
  },
  appInfoTitle: { fontFamily: FontFamily.displayBlack, fontSize: 16, color: Colors.primary, letterSpacing: 0.5 },
  appInfoSub: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  appInfoTerritory: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 15,
    borderRadius: BorderRadius.xl,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  logoutBtnText: { fontFamily: FontFamily.sansBold, fontSize: 15, color: Colors.white },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#FDE8EA', alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.textPrimary, marginTop: 2 },
});
