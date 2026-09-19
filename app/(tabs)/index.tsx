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
  
  // Format current date: e.g. "Tue, 19 Sep 2026"
  const now = new Date();
  let formattedDate = 'Today';
  try {
    formattedDate = format(now, 'EEE, dd MMM yyyy');
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
    ? Math.round((totalPunchBags / monthlyTotalBags) * 100)
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
      {/* ── 1. TOP HEADER (CLEAN & MINIMALIST) ── */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingSubtitle}>{greeting},</Text>
          <Text style={styles.userNameBig}>{user?.name || 'Rehan'} 👋</Text>
          <Text style={styles.territorySub}>{teamSetting} • {territorySetting} Territory</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8} onPress={() => onRefresh()}>
            <Ionicons name="notifications-outline" size={22} color="#1F0B10" />
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

      {/* ── 2. HERO BRAND BANNER (MATCHING REFERENCE EXACTLY) ── */}
      <View style={styles.heroBanner}>
        <View style={styles.heroLeft}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTeText}>TE </Text>
            <Text style={styles.heroConnectText}>CONNECT</Text>
          </View>
          <Text style={styles.heroTeamText}>{teamSetting.toUpperCase()}</Text>
          <Text style={styles.heroMotto}>STRONGER SITES{'\n'}STRONGER TOMORROW</Text>
        </View>

        <View style={styles.heroRight}>
          <View style={styles.heroTagBadge}>
            <Text style={styles.heroTagBadgeText}>BUILD • CONNECT • GROW</Text>
          </View>
          <View style={styles.cementBagsRow}>
            <View style={[styles.cementBagPill, { backgroundColor: '#C91F2B' }]}>
              <Text style={styles.cementBagBrand}>ACC</Text>
              <Text style={styles.cementBagType}>F2R</Text>
            </View>
            <View style={[styles.cementBagPill, { backgroundColor: '#B8860B' }]}>
              <Text style={styles.cementBagBrand}>ACC</Text>
              <Text style={styles.cementBagType}>GOLD</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Dots Indicator */}
      <View style={styles.dotsRow}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      {/* ── 3. TODAY METRICS (4 CARDS IN 1 ROW - EXACT REFERENCE) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.datePill}>
          <Ionicons name="calendar-outline" size={13} color="#8A7277" style={{ marginRight: 4 }} />
          <Text style={styles.datePillText}>{formattedDate}</Text>
        </View>
      </View>

      <View style={styles.metrics4Row}>
        {/* Card 1: Slabs */}
        <TouchableOpacity
          style={styles.metricCardMini}
          onPress={() => router.push('/(tabs)/slab')}
          activeOpacity={0.85}
        >
          <View style={[styles.iconCircleMini, { backgroundColor: '#FBE8EC' }]}>
            <MaterialCommunityIcons name="office-building" size={20} color="#800E20" />
          </View>
          <Text style={styles.metricValMini}>{todaySlabsList.length || allSlabsList.length}</Text>
          <Text style={styles.metricLblMini}>Slabs</Text>
          <View style={[styles.trendBadge, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.trendText, { color: '#15803D' }]}>↑ 100%</Text>
          </View>
        </TouchableOpacity>

        {/* Card 2: Sales (Bags) */}
        <TouchableOpacity
          style={styles.metricCardMini}
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.85}
        >
          <View style={[styles.iconCircleMini, { backgroundColor: '#FEF3C7' }]}>
            <MaterialCommunityIcons name="package-variant-closed" size={20} color="#D97706" />
          </View>
          <Text style={styles.metricValMini}>{displaySalesBags}</Text>
          <Text style={styles.metricLblMini}>Sales (Bags)</Text>
          <View style={[styles.trendBadge, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.trendText, { color: '#15803D' }]}>↑ {monthlyTotalMT} MT</Text>
          </View>
        </TouchableOpacity>

        {/* Card 3: Active % */}
        <TouchableOpacity
          style={styles.metricCardMini}
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.85}
        >
          <View style={[styles.iconCircleMini, { backgroundColor: '#F0FDF4' }]}>
            <MaterialCommunityIcons name="target" size={20} color="#15803D" />
          </View>
          <Text style={styles.metricValMini}>{punchVolumePercent}%</Text>
          <Text style={styles.metricLblMini}>Active</Text>
          <View style={[styles.trendBadge, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.trendText, { color: '#15803D' }]}>Target 80%</Text>
          </View>
        </TouchableOpacity>

        {/* Card 4: Meetings */}
        <TouchableOpacity
          style={styles.metricCardMini}
          onPress={() => router.push('/(tabs)/meeting')}
          activeOpacity={0.85}
        >
          <View style={[styles.iconCircleMini, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="people" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.metricValMini}>{todayMeetingsList.length || allMeetingsList.length}</Text>
          <Text style={styles.metricLblMini}>Meetings</Text>
          <View style={[styles.trendBadge, { backgroundColor: '#EDE9FE' }]}>
            <Text style={[styles.trendText, { color: '#6D28D9' }]}>{allMeetingsList.length} Total</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 4. QUICK ACTIONS (3 PILL BUTTONS IN 1 ROW - EXACT REFERENCE) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/plus')}>
          <Text style={styles.seeAllLink}>See All ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions3Row}>
        {/* Action 1: Add Slab */}
        <TouchableOpacity
          style={styles.actionPillBtn}
          onPress={() => router.push('/slab/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionPillIconBox, { backgroundColor: '#FBE8EC' }]}>
            <MaterialCommunityIcons name="office-building" size={20} color="#800E20" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionPillTitle}>Add Slab</Text>
            <Text style={styles.actionPillSub}>Log new slab</Text>
          </View>
        </TouchableOpacity>

        {/* Action 2: Add Sale */}
        <TouchableOpacity
          style={styles.actionPillBtn}
          onPress={() => router.push('/sale/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionPillIconBox, { backgroundColor: '#FEF3C7' }]}>
            <MaterialCommunityIcons name="package-variant-closed" size={20} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionPillTitle}>Add Sale</Text>
            <Text style={styles.actionPillSub}>Record sales</Text>
          </View>
        </TouchableOpacity>

        {/* Action 3: Add Meeting */}
        <TouchableOpacity
          style={styles.actionPillBtn}
          onPress={() => router.push('/meeting/add')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionPillIconBox, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="people" size={20} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionPillTitle}>Add Meet</Text>
            <Text style={styles.actionPillSub}>Plan meeting</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 5. TODAY'S SCHEDULE (2 SIDE-BY-SIDE CARDS - EXACT REFERENCE) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/slab')}>
          <Text style={styles.seeAllLink}>View All ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.schedule2ColRow}>
        {/* Left Card: Slabs Today */}
        <TouchableOpacity
          style={styles.scheduleBoxCard}
          onPress={() => router.push('/(tabs)/slab')}
          activeOpacity={0.85}
        >
          <View style={styles.scheduleBoxHeader}>
            <View style={[styles.scheduleBoxIcon, { backgroundColor: '#FBE8EC' }]}>
              <MaterialCommunityIcons name="office-building" size={18} color="#800E20" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduleBoxTitle}>Slabs Today</Text>
              <Text style={styles.scheduleBoxSub}>{todaySlabsList.length || allSlabsList.length} Scheduled ›</Text>
            </View>
          </View>

          <View style={styles.scheduleBoxDivider} />

          {allSlabsList.slice(0, 2).map((slab) => (
            <View key={slab.slab_id} style={styles.scheduleItemLine}>
              <MaterialCommunityIcons name="office-building" size={13} color="#800E20" style={{ marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleItemName} numberOfLines={1}>{slab.dealer_name}</Text>
                <Text style={styles.scheduleItemMeta} numberOfLines={1}>
                  {slab.expected_cement || '200 bags'} • {slab.contractor_name || 'Contractor'}
                </Text>
              </View>
            </View>
          ))}
        </TouchableOpacity>

        {/* Right Card: Meetings Today */}
        <TouchableOpacity
          style={styles.scheduleBoxCard}
          onPress={() => router.push('/(tabs)/meeting')}
          activeOpacity={0.85}
        >
          <View style={styles.scheduleBoxHeader}>
            <View style={[styles.scheduleBoxIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="people" size={18} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduleBoxTitle}>Meetings</Text>
              <Text style={styles.scheduleBoxSub}>{allMeetingsList.length} Scheduled ›</Text>
            </View>
          </View>

          <View style={styles.scheduleBoxDivider} />

          {allMeetingsList.length === 0 ? (
            <View style={styles.scheduleItemLine}>
              <Text style={styles.scheduleItemMeta}>No meetings scheduled today</Text>
            </View>
          ) : (
            allMeetingsList.slice(0, 2).map((mtg) => (
              <View key={mtg.meeting_id} style={styles.scheduleItemLine}>
                <MaterialCommunityIcons name="account-group" size={13} color="#7C3AED" style={{ marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleItemName} numberOfLines={1}>{mtg.meeting_name || mtg.meeting_type}</Text>
                  <Text style={styles.scheduleItemMeta} numberOfLines={1}>
                    {mtg.location || 'Site Location'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </TouchableOpacity>
      </View>

      {/* ── 6. MONTHLY PERFORMANCE (3 PROGRESS CARDS IN 1 ROW - EXACT REFERENCE) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Monthly Performance</Text>
        <View style={styles.datePill}>
          <Text style={styles.datePillText}>{currentMonthLabel} ⌄</Text>
        </View>
      </View>

      <View style={styles.monthly3CardsRow}>
        {/* Card 1: Sales */}
        <View style={styles.monthlyProgressCard}>
          <View style={styles.monthlyCardTop}>
            <MaterialCommunityIcons name="chart-bar" size={16} color="#800E20" />
            <Text style={styles.monthlyCardTitle}>Sales</Text>
          </View>
          <Text style={styles.monthlyCardValue}>
            {monthlyTotalBags} <Text style={styles.monthlyCardDenom}>/ 1,000</Text>
          </Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.min((monthlyTotalBags / 1000) * 100, 100)}%` as any }]} />
          </View>
          <Text style={styles.progressPercentText}>{((monthlyTotalBags / 1000) * 100).toFixed(0)}%</Text>
        </View>

        {/* Card 2: 80% Active Punch */}
        <View style={styles.monthlyProgressCard}>
          <View style={styles.monthlyCardTop}>
            <MaterialCommunityIcons name="heart-pulse" size={16} color="#800E20" />
            <Text style={styles.monthlyCardTitle}>Active Punch</Text>
          </View>
          <Text style={styles.monthlyCardValue}>
            {totalPunchBags} <Text style={styles.monthlyCardDenom}>/ {required80PercentPunch}</Text>
          </Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.min(punchVolumePercent, 100)}%` as any }]} />
          </View>
          <Text style={styles.progressPercentText}>{punchVolumePercent}%</Text>
        </View>

        {/* Card 3: 40% Contractor Base */}
        <View style={styles.monthlyProgressCard}>
          <View style={styles.monthlyCardTop}>
            <MaterialCommunityIcons name="account-hard-hat" size={16} color="#800E20" />
            <Text style={styles.monthlyCardTitle}>Contr. Active</Text>
          </View>
          <Text style={styles.monthlyCardValue}>
            {activeContractorsCount} <Text style={styles.monthlyCardDenom}>/ {totalContractorsCount}</Text>
          </Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.min(contractorActivePercent, 100)}%` as any }]} />
          </View>
          <Text style={styles.progressPercentText}>{contractorActivePercent.toFixed(0)}%</Text>
        </View>
      </View>

      {/* ── 7. DEALER SALES LEADERBOARD (MTD - EXACT REFERENCE) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Dealer Sales Leaderboard (MTD)</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/sales')}>
          <Text style={styles.seeAllLink}>View All ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.leaderboardCard}>
        {topDealersList.length === 0 ? (
          <View style={styles.emptyLeaderboard}>
            <Text style={styles.emptyLeaderboardText}>No sales recorded yet. Log your first sale above!</Text>
          </View>
        ) : (
          topDealersList.map((d, idx) => (
            <View key={d.dealer_id} style={[styles.leaderRow, idx === topDealersList.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[
                styles.rankBadge,
                idx === 0 ? styles.rank1 : idx === 1 ? styles.rank2 : styles.rank3
              ]}>
                <Text style={styles.rankBadgeText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.leaderDealerName}>{d.dealer_name}</Text>
                <Text style={styles.leaderDealerArea}>{d.area}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.leaderBagsText}>{d.total_bags} Bags</Text>
                <Text style={styles.leaderTrendText}>↑ {(d.total_bags / 20).toFixed(1)} MT</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F4F5', // Soft, clean rose-tinted background
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 40,
  },

  // 1. Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#8A7277',
    fontWeight: '500',
  },
  userNameBig: {
    fontSize: 22,
    fontWeight: '900',
    color: '#17060A',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  territorySub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#800E20',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFE4E7',
    shadowColor: 'rgba(128, 14, 32, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#E53935',
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
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#800E20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FBE8EC',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  // 2. Hero Banner (Red Gradient & Bags)
  heroBanner: {
    backgroundColor: '#4A0611',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroLeft: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTeText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroConnectText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#E53935',
    letterSpacing: 0.5,
  },
  heroTeamText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    marginTop: 2,
  },
  heroMotto: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.8,
    marginTop: 8,
    lineHeight: 13,
  },
  heroRight: {
    alignItems: 'flex-end',
  },
  heroTagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  heroTagBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cementBagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cementBagPill: {
    width: 48,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cementBagBrand: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cementBagType: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2D1D4',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#800E20',
  },

  // 3. Section Headers & Date Pills
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17060A',
    letterSpacing: -0.3,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFE4E7',
  },
  datePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A7277',
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#800E20',
  },

  // 4. 4 Metric Cards in 1 Row
  metrics4Row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  metricCardMini: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFE4E7',
    shadowColor: 'rgba(128, 14, 32, 0.05)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircleMini: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValMini: {
    fontSize: 16,
    fontWeight: '900',
    color: '#17060A',
  },
  metricLblMini: {
    fontSize: 10,
    color: '#8A7277',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  trendBadge: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trendText: {
    fontSize: 9,
    fontWeight: '800',
  },

  // 5. Quick Actions (3 Pill Buttons)
  quickActions3Row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  actionPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFE4E7',
    gap: 8,
    shadowColor: 'rgba(128, 14, 32, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  actionPillIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#17060A',
  },
  actionPillSub: {
    fontSize: 9,
    color: '#8A7277',
    marginTop: 1,
  },

  // 6. Today's Schedule (2 Side-by-Side Cards)
  schedule2ColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  scheduleBoxCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFE4E7',
    shadowColor: 'rgba(128, 14, 32, 0.05)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  scheduleBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleBoxIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#17060A',
  },
  scheduleBoxSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#800E20',
    marginTop: 1,
  },
  scheduleBoxDivider: {
    height: 1,
    backgroundColor: '#F5ECEE',
    marginVertical: 8,
  },
  scheduleItemLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  scheduleItemName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17060A',
  },
  scheduleItemMeta: {
    fontSize: 9,
    color: '#8A7277',
  },

  // 7. Monthly Performance (3 Progress Cards)
  monthly3CardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  monthlyProgressCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFE4E7',
    shadowColor: 'rgba(128, 14, 32, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  monthlyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  monthlyCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A7277',
  },
  monthlyCardValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#17060A',
    marginBottom: 6,
  },
  monthlyCardDenom: {
    fontSize: 9,
    fontWeight: '600',
    color: '#8A7277',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#F5E8EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#800E20',
    borderRadius: 2,
  },
  progressPercentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#800E20',
    textAlign: 'right',
  },

  // 8. Leaderboard
  leaderboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#EFE4E7',
    shadowColor: 'rgba(128, 14, 32, 0.05)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  emptyLeaderboard: {
    padding: 16,
    alignItems: 'center',
  },
  emptyLeaderboardText: {
    fontSize: 12,
    color: '#8A7277',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5ECEE',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rank1: { backgroundColor: '#FBBF24' },
  rank2: { backgroundColor: '#CBD5E1' },
  rank3: { backgroundColor: '#FDBA74' },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#17060A',
  },
  leaderDealerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#17060A',
  },
  leaderDealerArea: {
    fontSize: 10,
    color: '#8A7277',
    marginTop: 1,
  },
  leaderBagsText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#800E20',
  },
  leaderTrendText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '700',
    marginTop: 1,
  },
});
