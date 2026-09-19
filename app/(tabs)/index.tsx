import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  apiGetTodaySummary, apiGetDealerSalesSummary,
  apiGetSlabs, apiGetMeetings, apiGetSettings, apiGetSales,
  apiGetDealers, apiGetActiveTracker, apiGetContractors,
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import {
  getGreeting, currentMonthISO, bagsToMT, normalizeDate,
  PUNCH_VOLUME_TARGET_PERCENT, CONTRACTOR_ACTIVE_MIN_TARGET_PERCENT,
  simulateContractorPunchDistribution, calcContractorActivePercent,
  calcRequiredPunch,
} from '../../src/utils/helpers';
import { User, DealerSalesSummary } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = normalizeDate(new Date());

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  // 100% Live Google Sheets Queries
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGetSettings(),
  });

  const { data: allSales, refetch: refetchSales } = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiGetSales(),
  });

  const { data: dealers, refetch: refetchDealers } = useQuery({
    queryKey: ['dealers'],
    queryFn: () => apiGetDealers(),
  });

  const { data: contractors, refetch: refetchContractors } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => apiGetContractors(),
  });

  const { data: activeTrackers, refetch: refetchActive } = useQuery({
    queryKey: ['activeTrackers'],
    queryFn: () => apiGetActiveTracker(),
  });

  const { data: allSlabs, refetch: refetchSlabs } = useQuery({
    queryKey: ['slabs'],
    queryFn: () => apiGetSlabs(),
  });

  const { data: allMeetings, refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiGetMeetings(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSales(), refetchDealers(), refetchContractors(), refetchActive(), refetchSlabs(), refetchMeetings()
    ]);
    setRefreshing(false);
  }, [refetchSales, refetchDealers, refetchContractors, refetchActive, refetchSlabs, refetchMeetings]);

  const greeting = getGreeting();
  
  const now = new Date();
  let formattedDate = 'Today';
  try {
    formattedDate = format(now, 'EEEE, dd MMMM yyyy');
  } catch {}
  let currentMonthLabel = 'This Month';
  try {
    currentMonthLabel = format(now, 'MMMM yyyy');
  } catch {}

  // Live Sheet Data calculations
  const territorySetting = settings?.find(s => s.setting === 'territory')?.value || user?.territory || 'Jajpur';
  const teamSetting = settings?.find(s => s.setting === 'team')?.value || user?.team || 'Team Jajpur';

  // Slabs & Meetings for today
  const allSlabsList = allSlabs || [];
  const todaySlabsList = allSlabsList.filter(s => normalizeDate(s.slab_date) === today);
  const allMeetingsList = allMeetings || [];
  const todayMeetingsList = allMeetingsList.filter(m => normalizeDate(m.meeting_date) === today);

  // Sales Calculations
  const allSalesList = allSales || [];
  const monthlyTotalBags = allSalesList.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const monthlyTotalMT = (monthlyTotalBags / 20).toFixed(1);

  const todaySalesList = allSalesList.filter(s => normalizeDate(s.sale_date) === today);
  const todaySalesBags = todaySalesList.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const displaySalesBags = todaySalesBags > 0 ? todaySalesBags : monthlyTotalBags;

  // 80% Bag Punch Calculation
  const totalPunchBags = (activeTrackers || []).reduce((sum, t) => sum + (Number(t.punched_quantity_bags) || 0), 0);
  const required80PercentPunch = calcRequiredPunch(monthlyTotalBags, PUNCH_VOLUME_TARGET_PERCENT);
  const punchVolumePercent = monthlyTotalBags > 0
    ? Math.round((totalPunchBags / monthlyTotalBags) * 1000) / 10
    : 0;

  // 40% Contractor Active Base Calculation
  const sheetTotalContractors = (activeTrackers || []).reduce((max, t) => Math.max(max, Number(t.total_contractors) || 0), 0);
  const totalContractorsCount = sheetTotalContractors > 0
    ? sheetTotalContractors
    : Math.max((contractors || []).length, 10);

  const sheetActiveContractors = (activeTrackers || []).reduce((sum, t) => sum + (Number(t.active_contractors) || 0), 0);
  const activeContractorsCount = sheetActiveContractors > 0
    ? sheetActiveContractors
    : (totalPunchBags > 0 ? Math.ceil(totalPunchBags / 100) : 0);

  const contractorActivePercent = calcContractorActivePercent(activeContractorsCount, totalContractorsCount);

  // Quick 100 Bag Simulation Preview
  const quickSim = simulateContractorPunchDistribution(monthlyTotalBags, totalContractorsCount, 100);

  // Live Leaderboard from allSalesList & dealers
  const dealerMap: Record<string, { dealer_id: string; dealer_name: string; area: string; total_bags: number }> = {};
  
  (dealers || []).forEach(d => {
    dealerMap[d.dealer_id] = {
      dealer_id: d.dealer_id,
      dealer_name: d.dealer_name,
      area: d.area || territorySetting,
      total_bags: 0,
    };
  });

  allSalesList.forEach(s => {
    const did = s.dealer_id || s.dealer_name;
    if (!dealerMap[did]) {
      dealerMap[did] = {
        dealer_id: did,
        dealer_name: s.dealer_name,
        area: territorySetting,
        total_bags: 0,
      };
    }
    dealerMap[did].total_bags += Number(s.quantity_bags) || 0;
  });

  const topDealersList = Object.values(dealerMap)
    .filter(d => d.total_bags > 0)
    .sort((a, b) => b.total_bags - a.total_bags)
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#800E20" />}
    >
      {/* ── 1. LARGE EXECUTIVE TOP HEADER ── */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingSubtitle}>{greeting},</Text>
          <Text style={styles.userNameBig}>{user?.name || 'Rehan'} 👋</Text>
          <View style={styles.liveTeamBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.liveTeamText}>{teamSetting} • {territorySetting}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8} onPress={() => onRefresh()}>
            <Ionicons name="notifications-outline" size={24} color="#1F0B10" />
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>3</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.avatarCircle} activeOpacity={0.8}>
            <Text style={styles.avatarLetter}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'R'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. BIG EXECUTIVE COMMAND HERO CARD (PROTON VAULT WINE) ── */}
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

        {/* Big Sales Volume Display */}
        <View style={styles.heroMainMetricBox}>
          <Text style={styles.heroMainMetricLabel}>TOTAL SALES VOLUME ({currentMonthLabel.toUpperCase()})</Text>
          <View style={styles.heroMainMetricRow}>
            <Text style={styles.heroMainMetricMT}>{monthlyTotalMT}</Text>
            <Text style={styles.heroMainMetricUnit}>MT</Text>
            <View style={styles.heroBagsPill}>
              <Text style={styles.heroBagsPillText}>{monthlyTotalBags} Bags</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroDivider} />

        {/* Dual Target Status Badges */}
        <View style={styles.heroTargetsRow}>
          <View style={styles.heroTargetItem}>
            <Text style={styles.heroTargetLabel}>80% BAG PUNCH TARGET</Text>
            <Text style={styles.heroTargetVal}>{punchVolumePercent}% <Text style={styles.heroTargetSub}>({totalPunchBags}/{required80PercentPunch} Bg)</Text></Text>
          </View>

          <View style={styles.heroTargetDivider} />

          <View style={styles.heroTargetItem}>
            <Text style={styles.heroTargetLabel}>40% CONTR. ACTIVE</Text>
            <Text style={styles.heroTargetVal}>{contractorActivePercent.toFixed(0)}% <Text style={styles.heroTargetSub}>({activeContractorsCount}/{totalContractorsCount} Active)</Text></Text>
          </View>
        </View>
      </View>

      {/* ── 3. DATE BAR ── */}
      <View style={styles.dateBarRow}>
        <Text style={styles.sectionHeaderTitle}>Today's Live Metrics</Text>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar" size={15} color="#800E20" style={{ marginRight: 6 }} />
          <Text style={styles.dateBadgeText}>{formattedDate}</Text>
        </View>
      </View>

      {/* ── 4. BIG 2x2 METRICS GRID (LARGE, BOLD, SPACIOUS) ── */}
      <View style={styles.bigMetricsGrid}>
        {/* Card 1: Slabs */}
        <TouchableOpacity
          style={styles.bigMetricCard}
          onPress={() => router.push('/(tabs)/slab')}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.largeIconBox, { backgroundColor: '#FBE8EC' }]}>
              <MaterialCommunityIcons name="office-building" size={28} color="#800E20" />
            </View>
            <View style={styles.trendPill}>
              <Text style={styles.trendPillText}>{todaySlabsList.length > 0 ? `${todaySlabsList.length} Today` : `${allSlabsList.length} Total`}</Text>
            </View>
          </View>
          <Text style={styles.bigMetricNumber}>{allSlabsList.length}</Text>
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
              <MaterialCommunityIcons name="package-variant-closed" size={28} color="#D97706" />
            </View>
            <View style={[styles.trendPill, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.trendPillText, { color: '#B45309' }]}>{monthlyTotalMT} MT</Text>
            </View>
          </View>
          <Text style={styles.bigMetricNumber}>{displaySalesBags}</Text>
          <Text style={styles.bigMetricLabel}>Total Sales (Bags)</Text>
        </TouchableOpacity>

        {/* Card 3: 80% Bag Volume Punch */}
        <TouchableOpacity
          style={styles.bigMetricCard}
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.largeIconBox, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="cube-send" size={28} color="#15803D" />
            </View>
            <View style={[styles.trendPill, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.trendPillText, { color: '#15803D' }]}>Target 80%</Text>
            </View>
          </View>
          <Text style={[styles.bigMetricNumber, { color: punchVolumePercent >= 80 ? '#15803D' : '#800E20' }]}>
            {punchVolumePercent}%
          </Text>
          <Text style={styles.bigMetricLabel}>Bag Punch Volume</Text>
        </TouchableOpacity>

        {/* Card 4: 40% Contractor Active Base */}
        <TouchableOpacity
          style={styles.bigMetricCard}
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.largeIconBox, { backgroundColor: '#EDE9FE' }]}>
              <MaterialCommunityIcons name="account-hard-hat" size={28} color="#7C3AED" />
            </View>
            <View style={[styles.trendPill, { backgroundColor: '#EDE9FE' }]}>
              <Text style={[styles.trendPillText, { color: '#6D28D9' }]}>Min 40%</Text>
            </View>
          </View>
          <Text style={[styles.bigMetricNumber, { color: contractorActivePercent >= 40 ? '#15803D' : '#D97706' }]}>
            {contractorActivePercent.toFixed(1)}%
          </Text>
          <Text style={styles.bigMetricLabel}>Contractor Active Base</Text>
        </TouchableOpacity>
      </View>

      {/* ── 5. BIG FIELD QUICK ACTIONS (LARGE SPACIOUS TOUCH CARDS) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Quick Field Actions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/plus')}>
          <Text style={styles.seeAllText}>All Actions ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActionCardsCol}>
        {/* Action 1: Add Slab */}
        <TouchableOpacity
          style={styles.actionBigButton}
          onPress={() => router.push('/slab/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#800E20' }]}>
            <MaterialCommunityIcons name="office-building-marker" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitleBig}>Schedule New Slab</Text>
            <Text style={styles.actionSubtitle}>Add casting date, contractor, and site GPS</Text>
          </View>
          <View style={styles.actionChevronCircle}>
            <Feather name="arrow-up-right" size={20} color="#800E20" />
          </View>
        </TouchableOpacity>

        {/* Action 2: Add Sale / Punch */}
        <TouchableOpacity
          style={styles.actionBigButton}
          onPress={() => router.push('/sale/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#4A0611' }]}>
            <MaterialCommunityIcons name="cart-plus" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitleBig}>Record Sale & Punch</Text>
            <Text style={styles.actionSubtitle}>Log ACC F2R / GOLD bags or contractor punch</Text>
          </View>
          <View style={styles.actionChevronCircle}>
            <Feather name="arrow-up-right" size={20} color="#800E20" />
          </View>
        </TouchableOpacity>

        {/* Action 3: Add Meeting */}
        <TouchableOpacity
          style={styles.actionBigButton}
          onPress={() => router.push('/meeting/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#6B1224' }]}>
            <MaterialCommunityIcons name="account-multiple-plus" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitleBig}>Schedule Meeting</Text>
            <Text style={styles.actionSubtitle}>Log customer, contractor or site meet</Text>
          </View>
          <View style={styles.actionChevronCircle}>
            <Feather name="arrow-up-right" size={20} color="#800E20" />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 6. TODAY'S SCHEDULE (SPACIOUS GLASS CARDS) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Today's Schedule & Slabs</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/slab')}>
          <Text style={styles.seeAllText}>View Calendar ›</Text>
        </TouchableOpacity>
      </View>

      {allSlabsList.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="calendar-outline" size={32} color="#800E20" />
          </View>
          <Text style={styles.emptyStateTitle}>No Slabs Scheduled Today</Text>
          <Text style={styles.emptyStateSub}>Tap 'Schedule New Slab' above to add your first casting.</Text>
        </View>
      ) : (
        <View style={styles.scheduleListCol}>
          {allSlabsList.slice(0, 3).map((slab) => (
            <TouchableOpacity
              key={slab.slab_id}
              style={styles.realScheduleCard}
              onPress={() => router.push(`/slab/${slab.slab_id}` as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.realScheduleIcon, { backgroundColor: '#FBE8EC' }]}>
                <MaterialCommunityIcons name="office-building" size={24} color="#800E20" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.scheduleDealerTitle}>{slab.dealer_name}</Text>
                  <View style={[
                    styles.statusBadgeSmall,
                    slab.status === 'COMPLETED' ? styles.statusComp : slab.status === 'CANCELLED' ? styles.statusCanc : styles.statusUpc
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      slab.status === 'COMPLETED' ? { color: '#15803D' } : slab.status === 'CANCELLED' ? { color: '#6B7280' } : { color: '#800E20' }
                    ]}>
                      {slab.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.scheduleMetaText}>
                  👷 {slab.contractor_name || 'No contractor'} • 🧱 {slab.expected_cement ? `${slab.expected_cement} Bags` : '200 Bags'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── 7. DEALER SALES LEADERBOARD (BIG EXECUTIVE GLASS CARDS) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Dealer Leaderboard ({currentMonthLabel})</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/sales')}>
          <Text style={styles.seeAllText}>Sales Screen ›</Text>
        </TouchableOpacity>
      </View>

      {topDealersList.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>No Sales Logged Yet</Text>
          <Text style={styles.emptyStateSub}>Record sales to see dealer rankings here.</Text>
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
                <Text style={styles.leaderDealerArea}>{dealer.area}</Text>
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
    backgroundColor: '#F9F5F6',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
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
  },
  userNameBig: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  liveTeamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBE8EC',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E8D5DA',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  liveTeamText: {
    fontSize: 11,
    fontWeight: '800',
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
    backgroundColor: '#E53935',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#800E20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FBE8EC',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  // 2. Big Hero Command Card
  heroCardBig: {
    backgroundColor: '#4A0611',
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
  heroMainMetricBox: {
    marginTop: 18,
  },
  heroMainMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1,
  },
  heroMainMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  heroMainMetricMT: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  heroMainMetricUnit: {
    fontSize: 20,
    fontWeight: '800',
    color: '#E53935',
  },
  heroBagsPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  heroBagsPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 16,
  },
  heroTargetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTargetItem: {
    flex: 1,
  },
  heroTargetLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.8,
  },
  heroTargetVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 3,
  },
  heroTargetSub: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  heroTargetDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
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
    fontWeight: '900',
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
    borderWidth: 1.5,
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
    padding: 18,
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
    width: 48,
    height: 48,
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
    fontSize: 32,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: -0.5,
  },
  bigMetricLabel: {
    fontSize: 12,
    color: '#8A7277',
    fontWeight: '700',
    marginTop: 4,
  },

  // 5. Quick Actions
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    borderRadius: 24,
    padding: 18,
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
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },

  // 6. Schedule List & Cards
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 24,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#8A7277',
    textAlign: 'center',
  },
  scheduleListCol: {
    gap: 12,
    marginBottom: 24,
  },
  realScheduleCard: {
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
  realScheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleDealerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
  },
  statusBadgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusUpc: {
    backgroundColor: '#FBE8EC',
  },
  statusComp: {
    backgroundColor: '#DCFCE7',
  },
  statusCanc: {
    backgroundColor: '#F3F4F6',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scheduleMetaText: {
    fontSize: 13,
    color: '#6B4E55',
    marginTop: 4,
    fontWeight: '600',
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
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  leaderRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  rankBadgeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankGold: { backgroundColor: '#FBBF24' },
  rankSilver: { backgroundColor: '#CBD5E1' },
  rankBronze: { backgroundColor: '#FDBA74' },
  rankBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1F0B10',
  },
  leaderDealerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  leaderDealerArea: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
  leaderDealerMT: {
    fontSize: 16,
    fontWeight: '900',
    color: '#800E20',
  },
  leaderDealerBags: {
    fontSize: 11,
    color: '#8A7277',
  },
});
