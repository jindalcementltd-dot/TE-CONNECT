import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { apiGetUsers, apiGetDealers, apiGetSettings } from '../../src/services/api';
import { getUser, logout } from '../../src/services/auth';
import { User } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function AdminScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => { getUser().then(setUser); }, []);

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: apiGetUsers });
  const { data: dealers } = useQuery({ queryKey: ['dealers'], queryFn: apiGetDealers });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: apiGetSettings });

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out from TE CONNECT?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  const activeUsers = (users || []).filter(u => u.active !== false && String(u.active).toLowerCase() !== 'false').length;
  const activeDealers = (dealers || []).filter(d => d.active).length;
  const territory = settings?.find(s => s.setting === 'territory')?.value || user?.territory || 'Jajpur';
  const team = settings?.find(s => s.setting === 'team')?.value || user?.team || 'Team Jajpur';
  const activeTarget = settings?.find(s => s.setting === 'active_target')?.value || '80';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Team Profile & Settings</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}><Ionicons name="log-out-outline" size={24} color={Colors.error} /></TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.userHeroCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name || 'Field Officer'}</Text>
            <Text style={styles.userRole}>{user?.role || 'TE'} • {user?.team || team}</Text>
            <Text style={styles.userLoginId}>Login ID: {user?.login_id || 'user'}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeUsers}</Text>
            <Text style={styles.statLabel}>Active Officers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeDealers}</Text>
            <Text style={styles.statLabel}>Counters</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeTarget}%</Text>
            <Text style={styles.statLabel}>Punch Target</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Configuration (Google Sheet)</Text>
          <SettingRow label="Territory" value={territory} />
          <SettingRow label="Team Title" value={team} />
          <SettingRow label="Volume Punch Target" value={`${activeTarget}%`} />
          <SettingRow label="Registered Users" value={String((users || []).length)} />
          <SettingRow label="Total Dealers" value={String((dealers || []).length)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Team Members & Officers ({(users || []).length})</Text>
          {(users || []).map(u => {
            const isActive = u.active !== false && String(u.active).toLowerCase() !== 'false';
            return (
              <View key={u.user_id || u.login_id} style={styles.userRow}>
                <View style={[styles.roleTag, { backgroundColor: u.role === 'ADMIN' ? Colors.primaryLight : Colors.successLight }]}>
                  <Text style={[styles.roleTagText, { color: u.role === 'ADMIN' ? Colors.primary : Colors.success }]}>{u.role || 'TE'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{u.name}</Text>
                  <Text style={styles.memberLogin}>@{u.login_id} • {u.territory || territory}</Text>
                </View>
                <View style={[styles.activeDot, { backgroundColor: isActive ? Colors.success : Colors.error }]} />
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dealer Counters ({(dealers || []).length})</Text>
          {(dealers || []).slice(0, 10).map(d => (
            <TouchableOpacity key={d.dealer_id} style={styles.dealerRow} onPress={() => router.push(`/dealer/${d.dealer_id}` as any)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{d.dealer_name}</Text>
                <Text style={styles.memberLogin}>{d.area || territory} • TE: {d.assigned_te || 'Team'}</Text>
              </View>
              <View style={styles.qrBadgeCircle}><Ionicons name="qr-code" size={18} color={Colors.primary} /></View>
            </TouchableOpacity>
          ))}
          {(dealers || []).length > 10 && (
            <Text style={styles.moreText}>+{(dealers || []).length - 10} more counters in Google Sheets</Text>
          )}
        </View>

        <TouchableOpacity style={styles.logoutCard} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out from Workspace</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing['5xl'] }} />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 60 : Spacing['2xl'], paddingBottom: Spacing.base, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36 },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  logoutBtn: { width: 36, alignItems: 'flex-end' },
  scroll: { flex: 1, padding: Spacing.lg },

  userHeroCard: { backgroundColor: Colors.primaryDark, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg, shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  userAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  userAvatarText: { fontFamily: FontFamily.displayBlack, fontSize: FontSize['3xl'], color: Colors.white },
  userName: { fontFamily: FontFamily.displayBold, fontSize: FontSize.xl, color: Colors.white },
  userRole: { fontFamily: FontFamily.sansSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  userLoginId: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  statValue: { fontFamily: FontFamily.displayBlack, fontSize: FontSize['2xl'], color: Colors.primary },
  statLabel: { fontFamily: FontFamily.sansBold, fontSize: 11, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },

  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.textPrimary, marginBottom: Spacing.md },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  roleTag: { borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  roleTagText: { fontFamily: FontFamily.sansBold, fontSize: 10, letterSpacing: 0.5 },
  memberName: { fontFamily: FontFamily.displayBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  memberLogin: { fontFamily: FontFamily.sansRegular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  dealerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  qrBadgeCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: FontFamily.sansSemiBold, fontSize: 12, color: Colors.textSecondary, marginTop: 10, textAlign: 'center' },

  logoutCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.errorLight, shadowColor: 'rgba(220, 38, 38, 0.08)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  logoutText: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.error },
});

const settingStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  label: { fontFamily: FontFamily.sansSemiBold, fontSize: FontSize.sm, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary },
});
