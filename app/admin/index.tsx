import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
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

  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    return (
      <View style={styles.center}>
        <View style={styles.lockIconCircle}>
          <MaterialCommunityIcons name="shield-lock-outline" size={48} color="#800E20" />
        </View>
        <Text style={styles.notAllowed}>Access Restricted</Text>
        <Text style={styles.notAllowedSub}>Admin / Manager executive access only.</Text>
      </View>
    );
  }

  const activeUsers = (users || []).filter(u => u.active).length;
  const activeDealers = (dealers || []).filter(d => d.active).length;
  const territory = settings?.find(s => s.setting === 'territory')?.value || 'Jajpur';
  const team = settings?.find(s => s.setting === 'team')?.value || 'Team Jajpur';
  const activeTarget = settings?.find(s => s.setting === 'active_target')?.value || '80';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F0B10" />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Settings</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── 1. CURRENT USER HERO CARD ── */}
        <View style={styles.userHeroCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'A'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name || 'Administrator'}</Text>
            <Text style={styles.userRole}>{user?.role} • {user?.team || team}</Text>
            <Text style={styles.userLoginId}>ID: {user?.login_id || 'admin'}</Text>
          </View>
        </View>

        {/* ── 2. QUICK STATS 3-COL ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeUsers}</Text>
            <Text style={styles.statLabel}>Active TEs</Text>
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

        {/* ── 3. APP CONFIGURATION CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Configuration (Google Sheet)</Text>
          <SettingRow label="Territory" value={territory} />
          <SettingRow label="Team Title" value={team} />
          <SettingRow label="Volume Target" value={`${activeTarget}%`} />
          <SettingRow label="Total Users" value={String((users || []).length)} />
          <SettingRow label="Total Dealers" value={String((dealers || []).length)} />
        </View>

        {/* ── 4. TEAM MEMBERS ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Team Members ({(users || []).length})</Text>
          {(users || []).map(u => (
            <View key={u.user_id} style={styles.userRow}>
              <View style={[styles.roleTag, { backgroundColor: u.role === 'ADMIN' ? '#FBE8EC' : '#DCFCE7' }]}>
                <Text style={[styles.roleTagText, { color: u.role === 'ADMIN' ? '#800E20' : '#15803D' }]}>{u.role}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{u.name}</Text>
                <Text style={styles.memberLogin}>@{u.login_id}</Text>
              </View>
              <View style={[styles.activeDot, { backgroundColor: u.active ? '#15803D' : '#DC2626' }]} />
            </View>
          ))}
        </View>

        {/* ── 5. DEALERS LIST ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dealer Counters ({(dealers || []).length})</Text>
          {(dealers || []).slice(0, 10).map(d => (
            <TouchableOpacity
              key={d.dealer_id}
              style={styles.dealerRow}
              onPress={() => router.push(`/dealer/${d.dealer_id}` as any)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{d.dealer_name}</Text>
                <Text style={styles.memberLogin}>{d.area || 'Jajpur'} • TE: {d.assigned_te || 'Team'}</Text>
              </View>
              <View style={styles.qrBadgeCircle}>
                <Ionicons name="qr-code" size={18} color="#800E20" />
              </View>
            </TouchableOpacity>
          ))}
          {(dealers || []).length > 10 && (
            <Text style={styles.moreText}>+{(dealers || []).length - 10} more counters in Google Sheets</Text>
          )}
        </View>

        {/* ── 6. LOGOUT BUTTON ── */}
        <TouchableOpacity style={styles.logoutCard} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out from Workspace</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
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
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F9F5F6',
  },
  lockIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  notAllowed: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 6,
  },
  notAllowedSub: {
    fontSize: 14,
    color: '#8A7277',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  backBtn: {
    width: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
  },
  logoutBtn: {
    width: 36,
    alignItems: 'flex-end',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },

  // 1. User Hero Card
  userHeroCard: {
    backgroundColor: '#4A0611',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  userAvatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  userRole: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    fontWeight: '600',
  },
  userLoginId: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },

  // 2. Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#800E20',
  },
  statLabel: {
    fontSize: 11,
    color: '#8A7277',
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },

  // 3. Section Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
    gap: 12,
  },
  roleTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F0B10',
  },
  memberLogin: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dealerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  qrBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    shadowColor: 'rgba(220, 38, 38, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#DC2626',
  },
});

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  label: {
    fontSize: 13,
    color: '#8A7277',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#1F0B10',
    fontWeight: '800',
  },
});

