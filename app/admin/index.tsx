import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiGetUsers, apiGetDealers, apiGetSettings } from '../../src/services/api';
import { getUser, logout } from '../../src/services/auth';
import { User } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

export default function AdminScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => { getUser().then(setUser); }, []);

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: apiGetUsers });
  const { data: dealers } = useQuery({ queryKey: ['dealers'], queryFn: apiGetDealers });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: apiGetSettings });

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🔒</Text>
        <Text style={styles.notAllowed}>Access Restricted</Text>
        <Text style={styles.notAllowedSub}>Admin/Manager access only.</Text>
      </View>
    );
  }

  const activeUsers = (users || []).filter(u => u.active).length;
  const activeDealers = (dealers || []).filter(d => d.active).length;
  const territory = settings?.find(s => s.setting === 'territory')?.value || '—';
  const team = settings?.find(s => s.setting === 'team')?.value || '—';
  const activeTarget = settings?.find(s => s.setting === 'active_target')?.value || '80';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Settings</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Current User */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user?.name?.charAt(0)?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userRole}>{user?.role} · {user?.team}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeUsers}</Text>
            <Text style={styles.statLabel}>Active Users</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeDealers}</Text>
            <Text style={styles.statLabel}>Active Dealers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeTarget}%</Text>
            <Text style={styles.statLabel}>Active Target</Text>
          </View>
        </View>

        {/* Settings Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App Configuration</Text>
          <SettingRow label="Territory" value={territory} />
          <SettingRow label="Team" value={team} />
          <SettingRow label="Active Target" value={`${activeTarget}%`} />
          <SettingRow label="Total Users" value={String((users || []).length)} />
          <SettingRow label="Total Dealers" value={String((dealers || []).length)} />
        </View>

        {/* Users List */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Team Members</Text>
          {(users || []).map(u => (
            <View key={u.user_id} style={styles.userRow}>
              <View style={[styles.roleTag, { backgroundColor: u.role === 'ADMIN' ? Colors.errorLight : u.role === 'MANAGER' ? Colors.primaryLight : Colors.borderLight }]}>
                <Text style={[styles.roleTagText, { color: u.role === 'ADMIN' ? Colors.error : u.role === 'MANAGER' ? Colors.primary : Colors.textMuted }]}>{u.role}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{u.name}</Text>
                <Text style={styles.memberLogin}>{u.login_id}</Text>
              </View>
              <View style={[styles.activeDot, { backgroundColor: u.active ? Colors.success : Colors.error }]} />
            </View>
          ))}
        </View>

        {/* Dealers */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dealers ({(dealers || []).length})</Text>
          {(dealers || []).slice(0, 10).map(d => (
            <TouchableOpacity
              key={d.dealer_id}
              style={styles.dealerRow}
              onPress={() => router.push(`/dealer/${d.dealer_id}` as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{d.dealer_name}</Text>
                <Text style={styles.memberLogin}>{d.area} · {d.assigned_te}</Text>
              </View>
              <Ionicons name="qr-code-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          ))}
          {(dealers || []).length > 10 && (
            <Text style={styles.moreText}>+{(dealers || []).length - 10} more dealers in Google Sheets</Text>
          )}
        </View>

        {/* Setup Guide Link */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Setup & Configuration</Text>
          <Text style={styles.setupNote}>
            ℹ️ To add users, dealers, and targets, edit the Google Sheet directly.{"\n\n"}
            See GOOGLE_SHEETS_SETUP.md in your project folder for full instructions.
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={settingStyles.row}>
      <Text style={settingStyles.label}>{label}</Text>
      <Text style={settingStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  notAllowed: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  notAllowedSub: { fontSize: 15, color: Colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  logoutBtn: { width: 36, alignItems: 'flex-end' },
  scroll: { flex: 1, padding: Spacing.base },
  userCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  userAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 22, fontWeight: '800', color: Colors.white },
  userName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  userRole: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 10 },
  roleTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  roleTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  memberName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  memberLogin: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  dealerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  moreText: { fontSize: 12, color: Colors.textMuted, marginTop: 10, textAlign: 'center' },
  setupNote: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  logoutCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.md, borderWidth: 1.5, borderColor: Colors.errorLight },
  logoutText: { fontSize: 16, fontWeight: '600', color: Colors.error },
});

const settingStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  label: { fontSize: 13, color: Colors.textSecondary },
  value: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
});
