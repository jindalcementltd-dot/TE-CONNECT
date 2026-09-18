import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, ImageBackground,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import {
  apiGetTodaySummary, apiGetDealerSalesSummary,
  apiGetSlabs, apiGetMeetings, apiGetTEActiveSummary,
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { getGreeting, formatDate, currentMonthISO, bagsToMT } from '../../src/utils/helpers';
import { User } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

// ── Sub-components ───────────────────────────────────────────

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={[summaryStyles.card, { borderTopColor: color }]}>
      <Text style={summaryStyles.icon}>{icon}</Text>
      <Text style={[summaryStyles.value, { color }]}>{value}</Text>
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

function QuickActionBtn({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity style={[qaStyles.btn, { backgroundColor: color + '18' }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={qaStyles.icon}>{icon}</Text>
      <Text style={[qaStyles.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={sectionStyles.header}>
      <Text style={sectionStyles.title}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={sectionStyles.seeAll}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const month = currentMonthISO();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const { data: todaySummary, refetch: refetchToday } = useQuery({
    queryKey: ['todaySummary', user?.name],
    queryFn: () => apiGetTodaySummary(user?.name),
    enabled: !!user,
  });

  const { data: dealerSales, refetch: refetchDealerSales } = useQuery({
    queryKey: ['dealerSalesSummary', month],
    queryFn: () => apiGetDealerSalesSummary(month),
  });

  const { data: todaySlabs, refetch: refetchSlabs } = useQuery({
    queryKey: ['slabs', today],
    queryFn: () => apiGetSlabs({ month }),
  });

  const { data: todayMeetings, refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings', today],
    queryFn: () => apiGetMeetings({ date: today }),
  });

  const { data: teamActive, refetch: refetchTeamActive } = useQuery({
    queryKey: ['teActiveSummary', month],
    queryFn: () => apiGetTEActiveSummary(month),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchToday(), refetchDealerSales(), refetchSlabs(),
      refetchMeetings(), refetchTeamActive(),
    ]);
    setRefreshing(false);
  }, []);

  const greeting = getGreeting();
  const topDealers = (dealerSales || []).filter(d => d.total_bags > 0).slice(0, 5);
  const upcomingSlabs = (todaySlabs || [])
    .filter(s => s.status === 'UPCOMING')
    .sort((a, b) => a.slab_date.localeCompare(b.slab_date))
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting} 👋</Text>
          <Text style={styles.userName}>{user?.name || 'Loading...'}</Text>
          <Text style={styles.userInfo}>{user?.team} · {user?.territory}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.avatarBtn}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Hero Banner ── */}
      <View style={styles.heroBanner}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>TE CONNECT</Text>
          <Text style={styles.heroSubtitle}>TEAM JAJPUR</Text>
          <Text style={styles.heroDesc}>Field Command Center</Text>
        </View>
        <View style={styles.heroIllustration}>
          <Text style={styles.heroEmoji}>🏗️</Text>
        </View>
      </View>

      {/* ── Today's Summary ── */}
      <SectionHeader title="Today's Summary" />
      <View style={summaryStyles.grid}>
        <SummaryCard
          label="Slabs"
          value={String(todaySummary?.slabs_today ?? '—')}
          icon="🏗️"
          color={Colors.primary}
        />
        <SummaryCard
          label="Sales"
          value={todaySummary ? `${bagsToMT(todaySummary.sales_bags_today).toFixed(1)} MT` : '—'}
          icon="📦"
          color="#D97706"
        />
        <SummaryCard
          label="Active %"
          value={todaySummary ? `${todaySummary.active_percent.toFixed(0)}%` : '—'}
          icon="⚡"
          color="#16A34A"
        />
        <SummaryCard
          label="Meetings"
          value={String(todaySummary?.meetings_today ?? '—')}
          icon="🤝"
          color="#7C3AED"
        />
      </View>

      {/* ── Quick Actions ── */}
      <SectionHeader title="Quick Actions" />
      <View style={qaStyles.row}>
        <QuickActionBtn icon="🏗️" label="Add Slab" color={Colors.primary} onPress={() => router.push('/slab/add')} />
        <QuickActionBtn icon="📊" label="Add Sale" color="#D97706" onPress={() => router.push('/sale/add')} />
        <QuickActionBtn icon="🤝" label="Add Meeting" color="#7C3AED" onPress={() => router.push('/meeting/add')} />
      </View>

      {/* ── Today's Schedule ── */}
      {(todaySlabs?.filter(s => s.slab_date === today).length ?? 0) > 0 && (
        <>
          <SectionHeader title="Today's Slabs" onSeeAll={() => router.push('/(tabs)/slab')} />
          {todaySlabs?.filter(s => s.slab_date === today).map(slab => (
            <View key={slab.slab_id} style={scheduleStyles.card}>
              <View style={scheduleStyles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={scheduleStyles.dealer}>{slab.dealer_name}</Text>
                <Text style={scheduleStyles.info}>{slab.contractor_name} · {slab.expected_cement}</Text>
              </View>
              <View style={[scheduleStyles.badge, { backgroundColor: Colors.primaryLight }]}>
                <Text style={[scheduleStyles.badgeText, { color: Colors.primary }]}>{slab.status}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {(todayMeetings?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Today's Meetings" onSeeAll={() => router.push('/(tabs)/meeting')} />
          {todayMeetings?.slice(0, 3).map(mtg => (
            <View key={mtg.meeting_id} style={scheduleStyles.card}>
              <View style={[scheduleStyles.dot, { backgroundColor: '#7C3AED' }]} />
              <View style={{ flex: 1 }}>
                <Text style={scheduleStyles.dealer}>{mtg.meeting_name || mtg.meeting_type}</Text>
                <Text style={scheduleStyles.info}>{mtg.location} · {mtg.meeting_type}</Text>
              </View>
              <View style={[scheduleStyles.badge, { backgroundColor: '#EDE9FE' }]}>
                <Text style={[scheduleStyles.badgeText, { color: '#7C3AED' }]}>{mtg.status}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── Dealer Leaderboard ── */}
      {topDealers.length > 0 && (
        <>
          <SectionHeader title="Dealer Sales Leaderboard" onSeeAll={() => router.push('/(tabs)/sales')} />
          <View style={leaderStyles.container}>
            {topDealers.map((d, i) => (
              <View key={d.dealer_id} style={leaderStyles.row}>
                <View style={[leaderStyles.rank, i === 0 && leaderStyles.rankGold]}>
                  <Text style={[leaderStyles.rankText, i === 0 && leaderStyles.rankTextGold]}>
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={leaderStyles.name}>{d.dealer_name}</Text>
                  <Text style={leaderStyles.area}>{d.area}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={leaderStyles.mt}>{d.total_mt.toFixed(2)} MT</Text>
                  <Text style={leaderStyles.bags}>{d.total_bags} bags</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Upcoming Slabs ── */}
      {upcomingSlabs.length > 0 && (
        <>
          <SectionHeader title="Upcoming Slabs" onSeeAll={() => router.push('/(tabs)/slab')} />
          {upcomingSlabs.map(slab => (
            <View key={slab.slab_id} style={scheduleStyles.card}>
              <View style={scheduleStyles.dateBox}>
                <Text style={scheduleStyles.dateDay}>
                  {new Date(slab.slab_date).getDate()}
                </Text>
                <Text style={scheduleStyles.dateMon}>
                  {new Date(slab.slab_date).toLocaleString('default', { month: 'short' })}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={scheduleStyles.dealer}>{slab.dealer_name}</Text>
                <Text style={scheduleStyles.info}>{slab.contractor_name} · {slab.expected_cement}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: Colors.white,
  },
  headerLeft: { flex: 1 },
  headerRight: {},
  greeting: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  userInfo: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  avatarBtn: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  heroBanner: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    overflow: 'hidden',
  },
  heroContent: { flex: 1 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: Colors.white, letterSpacing: 1.5 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', letterSpacing: 2, marginTop: 2 },
  heroDesc: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  heroIllustration: {},
  heroEmoji: { fontSize: 56 },
});

const summaryStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.base,
    gap: 10,
    marginBottom: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  icon: { fontSize: 22, marginBottom: 6 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
});

const qaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: 10,
    marginBottom: Spacing.md,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  icon: { fontSize: 24, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '600' },
});

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});

const scheduleStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.base,
    marginBottom: 8,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginRight: 12,
  },
  dealer: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  info: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  dateMon: { fontSize: 10, fontWeight: '600', color: Colors.primary },
});

const leaderStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.base,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankGold: { backgroundColor: '#FEF3C7' },
  rankText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  rankTextGold: { color: '#D97706' },
  name: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  area: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  mt: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  bags: { fontSize: 11, color: Colors.textSecondary },
});
