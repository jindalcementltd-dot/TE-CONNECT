import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import {
  apiGetTodaySummary, apiGetDealerSalesSummary,
  apiGetSlabs, apiGetMeetings, apiGetSettings,
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { getGreeting, currentMonthISO, bagsToMT } from '../../src/utils/helpers';
import { User } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const month = currentMonthISO();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  // 100% Live Google Sheets Queries
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGetSettings(),
  });

  const { data: todaySummary, refetch: refetchToday } = useQuery({
    queryKey: ['todaySummary', user?.name],
    queryFn: () => apiGetTodaySummary(user?.name),
    enabled: !!user,
  });

  const { data: dealerSales, refetch: refetchDealerSales } = useQuery({
    queryKey: ['dealerSalesSummary', month],
    queryFn: () => apiGetDealerSalesSummary(month),
  });

  const { data: allSlabs, refetch: refetchSlabs } = useQuery({
    queryKey: ['slabs', month],
    queryFn: () => apiGetSlabs({ month }),
  });

  const { data: allMeetings, refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings', month],
    queryFn: () => apiGetMeetings({ month }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchToday(), refetchDealerSales(), refetchSlabs(), refetchMeetings()
    ]);
    setRefreshing(false);
  }, []);

  const greeting = getGreeting();
  
  // Format current date: e.g. "Tuesday, 19 Sep 2026"
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const formattedDate = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const currentMonthLabel = `${fullMonthNames[now.getMonth()]} ${now.getFullYear()}`;

  // Live Sheet Data calculations
  const territorySetting = settings?.find(s => s.setting === 'territory')?.value || user?.territory || 'Jajpur';
  const teamSetting = settings?.find(s => s.setting === 'team')?.value || user?.team || 'Team Jajpur';
  const targetActiveSetting = Number(settings?.find(s => s.setting === 'active_target')?.value || 80);

  // Real Slabs & Meetings for today
  const todaySlabsList = (allSlabs || []).filter(s => String(s.slab_date).startsWith(today));
  const todayMeetingsList = (allMeetings || []).filter(m => String(m.meeting_date).startsWith(today));

  // Real Summary metrics
  const realSlabsCount = todaySummary?.slabs_today ?? todaySlabsList.length;
  const realSalesBags = todaySummary?.sales_bags_today ?? 0;
  const realSalesMT = bagsToMT(realSalesBags);
  const realActivePercent = todaySummary?.active_percent ?? 0;
  const realMeetingsCount = todaySummary?.meetings_today ?? todayMeetingsList.length;

  // Monthly totals from Google Sheets
  const monthlyTotalBags = (dealerSales || []).reduce((sum, d) => sum + (Number(d.total_bags) || 0), 0);
  const monthlyTotalMT = (monthlyTotalBags / 20).toFixed(1);
  const topDealersList = (dealerSales || []).filter(d => (Number(d.total_bags) || 0) > 0).slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* ── 1. PROTON-GRADE TOP HEADER (BIG & LUXURY) ── */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingSubtitle}>{greeting},</Text>
          <Text style={styles.userNameBig}>{user?.name || 'Administrator'}</Text>
          <View style={styles.badgePill}>
            <View style={styles.greenLiveDot} />
            <Text style={styles.badgePillText}>{teamSetting} • {territorySetting}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8} onPress={() => onRefresh()}>
            <Ionicons name="notifications-outline" size={24} color="#1F0B10" />
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>0</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.8}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. BIG HERO CARD (PROTON VAULT WINE GRADIENT) ── */}
      <View style={styles.heroCardBig}>
        <View style={styles.heroTopRow}>
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.heroBrandTE}>TE </Text>
              <Text style={styles.heroBrandCONNECT}>CONNECT</Text>
            </View>
            <Text style={styles.heroTeamSubtitle}>{teamSetting.toUpperCase()} COMMAND CENTER</Text>
          </View>
          <View style={styles.securityShieldCircle}>
            <MaterialCommunityIcons name="shield-check" size={32} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroBottomRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>MONTH SALES</Text>
            <Text style={styles.heroStatValue}>{monthlyTotalMT} <Text style={styles.heroStatUnit}>MT</Text></Text>
          </View>
          <View style={styles.heroStatSeparator} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>ACTIVE TARGET</Text>
            <Text style={styles.heroStatValue}>{targetActiveSetting}%</Text>
          </View>
          <View style={styles.heroStatSeparator} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>SLABS (MTD)</Text>
            <Text style={styles.heroStatValue}>{allSlabs?.length || 0}</Text>
          </View>
        </View>
      </View>

      {/* ── 3. DATE BAR ── */}
      <View style={styles.dateBarRow}>
        <Text style={styles.sectionHeaderTitle}>Today's Live Metrics</Text>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar" size={14} color="#800E20" style={{ marginRight: 6 }} />
          <Text style={styles.dateBadgeText}>{formattedDate}</Text>
        </View>
      </View>

      {/* ── 4. BIG 2x2 METRICS GRID (BOLD & SPACIOUS) ── */}
      <View style={styles.bigMetricsGrid}>
        {/* Card 1: Slabs */}
        <TouchableOpacity
          style={styles.bigMetricCard}
          onPress={() => router.push('/(tabs)/slab')}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.largeIconBox, { backgroundColor: '#FBE8EC' }]}>
              <MaterialCommunityIcons name="office-building" size={26} color="#800E20" />
            </View>
            <View style={styles.trendPill}>
              <Text style={styles.trendPillText}>{realSlabsCount > 0 ? `${realSlabsCount} Active` : '0 Today'}</Text>
            </View>
          </View>
          <Text style={styles.bigMetricNumber}>{realSlabsCount}</Text>
          <Text style={styles.bigMetricLabel}>Slabs Scheduled</Text>
        </TouchableOpacity>

        {/* Card 2: Sales */}
        <TouchableOpacity
          style={styles.bigMetricCard}
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.largeIconBox, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={26} color="#D97706" />
            </View>
            <View style={[styles.trendPill, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.trendPillText, { color: '#B45309' }]}>{realSalesMT.toFixed(1)} MT</Text>
            </View>
          </View>
          <Text style={styles.bigMetricNumber}>{realSalesBags}</Text>
          <Text style={styles.bigMetricLabel}>Sales (Bags Today)</Text>
        </TouchableOpacity>

        {/* Card 3: Active % */}
        <TouchableOpacity
          style={styles.bigMetricCard}
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.largeIconBox, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="target" size={26} color="#15803D" />
            </View>
            <View style={[styles.trendPill, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.trendPillText, { color: '#15803D' }]}>Target {targetActiveSetting}%</Text>
            </View>
          </View>
          <Text style={styles.bigMetricNumber}>{realActivePercent}%</Text>
          <Text style={styles.bigMetricLabel}>Active Punching</Text>
        </TouchableOpacity>

        {/* Card 4: Meetings */}
        <TouchableOpacity
          style={styles.bigMetricCard}
          onPress={() => router.push('/(tabs)/meeting')}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.largeIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="people" size={26} color="#7C3AED" />
            </View>
            <View style={[styles.trendPill, { backgroundColor: '#EDE9FE' }]}>
              <Text style={[styles.trendPillText, { color: '#6D28D9' }]}>{allMeetings?.length || 0} Month</Text>
            </View>
          </View>
          <Text style={styles.bigMetricNumber}>{realMeetingsCount}</Text>
          <Text style={styles.bigMetricLabel}>Meetings Today</Text>
        </TouchableOpacity>
      </View>

      {/* ── 5. PROTON-GRADE QUICK ACTIONS (BIG BUTTONS) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Quick Field Actions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/plus')}>
          <Text style={styles.seeAllText}>All Actions ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActionCardsCol}>
        {/* Button 1: Add Slab */}
        <TouchableOpacity
          style={styles.actionBigButton}
          onPress={() => router.push('/slab/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#800E20' }]}>
            <MaterialCommunityIcons name="office-building-plus" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitleBig}>Add New Slab</Text>
            <Text style={styles.actionSubtitle}>Schedule casting, site & contractor</Text>
          </View>
          <View style={styles.actionChevronCircle}>
            <Feather name="arrow-up-right" size={18} color="#800E20" />
          </View>
        </TouchableOpacity>

        {/* Button 2: Add Sale / Punch */}
        <TouchableOpacity
          style={styles.actionBigButton}
          onPress={() => router.push('/sale/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#4A0611' }]}>
            <MaterialCommunityIcons name="cart-plus" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitleBig}>Record Sale & Punch</Text>
            <Text style={styles.actionSubtitle}>Log ACC F2R / GOLD bags or punch volume</Text>
          </View>
          <View style={styles.actionChevronCircle}>
            <Feather name="arrow-up-right" size={18} color="#800E20" />
          </View>
        </TouchableOpacity>

        {/* Button 3: Add Meeting */}
        <TouchableOpacity
          style={styles.actionBigButton}
          onPress={() => router.push('/meeting/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#6B1224' }]}>
            <MaterialCommunityIcons name="account-multiple-plus" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitleBig}>Schedule Meeting</Text>
            <Text style={styles.actionSubtitle}>Log customer, contractor or site meet</Text>
          </View>
          <View style={styles.actionChevronCircle}>
            <Feather name="arrow-up-right" size={18} color="#800E20" />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 6. REAL LIVE SCHEDULE (TODAY'S SLABS & MEETINGS) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Today's Live Schedule</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/slab')}>
          <Text style={styles.seeAllText}>View Calendar ›</Text>
        </TouchableOpacity>
      </View>

      {todaySlabsList.length === 0 && todayMeetingsList.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="calendar-outline" size={32} color="#800E20" />
          </View>
          <Text style={styles.emptyStateTitle}>No Slabs or Meetings Today</Text>
          <Text style={styles.emptyStateSub}>
            Everything is clean in Google Sheets. Tap any action button above to schedule your next activity!
          </Text>
        </View>
      ) : (
        <View style={styles.scheduleListCol}>
          {todaySlabsList.map((slab) => (
            <TouchableOpacity
              key={slab.slab_id}
              style={styles.realScheduleCard}
              onPress={() => router.push(`/slab/${slab.slab_id}` as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.realScheduleIcon, { backgroundColor: '#FBE8EC' }]}>
                <MaterialCommunityIcons name="office-building" size={22} color="#800E20" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.scheduleDealerTitle}>{slab.dealer_name}</Text>
                  <View style={styles.statusBadgeSmall}>
                    <Text style={styles.statusBadgeText}>{slab.status}</Text>
                  </View>
                </View>
                <Text style={styles.scheduleMetaText}>
                  {slab.contractor_name || 'No contractor'} • {slab.expected_cement || 'Cement unassigned'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {todayMeetingsList.map((mtg) => (
            <TouchableOpacity
              key={mtg.meeting_id}
              style={styles.realScheduleCard}
              onPress={() => router.push(`/meeting/${mtg.meeting_id}` as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.realScheduleIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="people" size={22} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.scheduleDealerTitle}>{mtg.meeting_name || mtg.meeting_type}</Text>
                  <View style={[styles.statusBadgeSmall, { backgroundColor: '#EDE9FE' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#7C3AED' }]}>{mtg.status}</Text>
                  </View>
                </View>
                <Text style={styles.scheduleMetaText}>
                  {mtg.location || 'Location unassigned'} • {mtg.meeting_type}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── 7. REAL LIVE DEALER LEADERBOARD (FROM SHEET) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Dealer Leaderboard ({currentMonthLabel})</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/sales')}>
          <Text style={styles.seeAllText}>Sales Screen ›</Text>
        </TouchableOpacity>
      </View>

      {topDealersList.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="trophy-outline" size={32} color="#800E20" />
          </View>
          <Text style={styles.emptyStateTitle}>No Sales Recorded This Month</Text>
          <Text style={styles.emptyStateSub}>
            As soon as sales are recorded in Google Sheets, the top dealers will automatically rank here with their MT volume!
          </Text>
          <TouchableOpacity
            style={styles.emptyStateBtn}
            onPress={() => router.push('/sale/add')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyStateBtnText}>+ Log First Sale</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.leaderboardContainer}>
          {topDealersList.map((dealer, idx) => (
            <View key={dealer.dealer_id} style={[styles.leaderRowItem, idx === topDealersList.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.rankBadgeCircle, idx === 0 ? styles.rankGold : idx === 1 ? styles.rankSilver : styles.rankBronze]}>
                <Text style={styles.rankBadgeText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.leaderDealerName}>{dealer.dealer_name}</Text>
                <Text style={styles.leaderDealerArea}>{dealer.area || territorySetting}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.leaderDealerMT}>{(dealer.total_bags / 20).toFixed(1)} MT</Text>
                <Text style={styles.leaderDealerBags}>{dealer.total_bags} bags</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6', // Soft luxury rosé background
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 40,
  },

  // 1. Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: '#8A7277',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  userNameBig: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2E4E7',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E8D5DA',
  },
  greenLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#800E20',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#800E20',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarWrap: {
    padding: 2,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#800E20',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4A0611',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  // 2. Big Hero Card
  heroCardBig: {
    backgroundColor: '#4A0611', // Deep Wine
    borderRadius: 28,
    padding: 22,
    marginBottom: 24,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBrandTE: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  heroBrandCONNECT: {
    fontSize: 26,
    fontWeight: '900',
    color: '#E53935',
    letterSpacing: 1,
  },
  heroTeamSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  securityShieldCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 18,
  },
  heroBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroStatUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E53935',
  },
  heroStatSeparator: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  // 3. Date Bar
  dateBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
    letterSpacing: -0.3,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#554246',
  },

  // 4. Big 2x2 Metrics Grid
  bigMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  bigMetricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  largeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendPill: {
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  trendPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#800E20',
  },
  bigMetricNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: -0.5,
  },
  bigMetricLabel: {
    fontSize: 12,
    color: '#8A7277',
    fontWeight: '600',
    marginTop: 4,
  },

  // 5. Quick Actions
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 6,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#800E20',
  },
  quickActionCardsCol: {
    gap: 12,
    marginBottom: 24,
  },
  actionBigButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitleBig: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#8A7277',
    fontWeight: '500',
    marginTop: 2,
  },
  actionChevronCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },

  // 6. Schedule List & Empty States
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 24,
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#8A7277',
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyStateBtn: {
    backgroundColor: '#800E20',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 16,
  },
  emptyStateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  scheduleListCol: {
    gap: 10,
    marginBottom: 24,
  },
  realScheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  realScheduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleDealerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  statusBadgeSmall: {
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#800E20',
  },
  scheduleMetaText: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 3,
  },

  // 7. Leaderboard
  leaderboardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 24,
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  leaderRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  rankBadgeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankGold: { backgroundColor: '#FBBF24' },
  rankSilver: { backgroundColor: '#CBD5E1' },
  rankBronze: { backgroundColor: '#FDBA74' },
  rankBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1F0B10',
  },
  leaderDealerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F0B10',
  },
  leaderDealerArea: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
  leaderDealerMT: {
    fontSize: 15,
    fontWeight: '900',
    color: '#800E20',
  },
  leaderDealerBags: {
    fontSize: 11,
    color: '#8A7277',
  },
});
