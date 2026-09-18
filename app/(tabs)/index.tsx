import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, Platform, Image,
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
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('September 2026');
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchToday(), refetchDealerSales(), refetchSlabs(), refetchMeetings()
    ]);
    setRefreshing(false);
  }, []);

  const greeting = getGreeting();
  
  // Format formatted date string: e.g. "Tue, 17 Sep 2026"
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedToday = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  // Default values matching mockup with fallback to live data
  const slabsCount = todaySummary?.slabs_today ?? 2;
  const salesBags = todaySummary?.sales_bags_today ? todaySummary.sales_bags_today : 400;
  const activePercent = todaySummary?.active_percent ? todaySummary.active_percent : 80;
  const meetingsCount = todaySummary?.meetings_today ?? 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* ── TOP HEADER ── */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingText}>{greeting},</Text>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user?.name || 'Rehan'}</Text>
            <Text style={styles.handWave}> 👋</Text>
          </View>
          <Text style={styles.teamTerritory}>Team Jajpur • Jajpur Territory</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Notification Bell with Badge */}
          <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>3</Text>
            </View>
          </TouchableOpacity>

          {/* User Avatar */}
          <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.8}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'R'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── HERO BANNER CARD ── */}
      <View style={styles.heroCard}>
        {/* Background glow & subtle overlay */}
        <View style={styles.heroOverlayLeft}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.heroBrandTE}>TE </Text>
            <Text style={styles.heroBrandCONNECT}>CONNECT</Text>
          </View>
          <Text style={styles.heroTeamJajpur}>TEAM JAJPUR</Text>

          <View style={styles.heroTaglineContainer}>
            <Text style={styles.heroTagline}>STRONGER SITES</Text>
            <Text style={styles.heroTagline}>STRONGER TOMORROW</Text>
          </View>
        </View>

        {/* Right side cement bags & badge graphic */}
        <View style={styles.heroRightGraphic}>
          <View style={styles.heroSubBadge}>
            <Text style={styles.heroSubBadgeText}>BUILD</Text>
            <Text style={styles.heroSubBadgeText}>CONNECT</Text>
            <Text style={styles.heroSubBadgeText}>GROW</Text>
          </View>

          <View style={styles.cementBagsRow}>
            {/* ACC F2R Bag mockup */}
            <View style={[styles.cementBag, styles.f2rBag]}>
              <Text style={styles.bagBrand}>ACC</Text>
              <Text style={styles.bagModel}>F2R</Text>
            </View>
            {/* ACC GOLD Bag mockup */}
            <View style={[styles.cementBag, styles.goldBag]}>
              <Text style={styles.bagBrand}>ACC</Text>
              <Text style={styles.bagModelGold}>GOLD</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Carousel Pagination Dots */}
      <View style={styles.dotsContainer}>
        <View style={[styles.dot, styles.activeDot]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      {/* ── TODAY SECTION ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitleMain}>Today</Text>
        <View style={styles.dateChip}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={styles.dateChipText}>{formattedToday}</Text>
        </View>
      </View>

      {/* 4 Metrics Cards */}
      <View style={styles.metricsGrid}>
        {/* Slabs */}
        <View style={styles.metricCard}>
          <View style={styles.metricIconBox}>
            <MaterialCommunityIcons name="office-building" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.metricValue}>{slabsCount}</Text>
          <Text style={styles.metricLabel}>Slabs</Text>
          <View style={styles.trendRow}>
            <Feather name="arrow-up" size={12} color="#16A34A" />
            <Text style={styles.trendTextGreen}>+100%</Text>
          </View>
        </View>

        {/* Sales */}
        <View style={styles.metricCard}>
          <View style={styles.metricIconBox}>
            <MaterialCommunityIcons name="package-variant-closed" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.metricValue}>{salesBags}</Text>
          <Text style={styles.metricLabel}>Sales (Bags)</Text>
          <View style={styles.trendRow}>
            <Feather name="arrow-up" size={12} color="#16A34A" />
            <Text style={styles.trendTextGreen}>+12%</Text>
          </View>
        </View>

        {/* Active */}
        <View style={styles.metricCard}>
          <View style={styles.metricIconBox}>
            <MaterialCommunityIcons name="target" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.metricValue}>{activePercent}%</Text>
          <Text style={styles.metricLabel}>Active</Text>
          <View style={styles.trendRow}>
            <Feather name="arrow-up" size={12} color="#16A34A" />
            <Text style={styles.trendTextGreen}>+5%</Text>
          </View>
        </View>

        {/* Meetings */}
        <View style={styles.metricCard}>
          <View style={styles.metricIconBox}>
            <Ionicons name="people" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.metricValue}>{meetingsCount}</Text>
          <Text style={styles.metricLabel}>Meetings</Text>
          <View style={styles.trendRow}>
            <Feather name="arrow-down" size={12} color="#DC2626" />
            <Text style={styles.trendTextRed}>-50%</Text>
          </View>
        </View>
      </View>

      {/* ── QUICK ACTIONS ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/plus')}>
          <Text style={styles.seeAllLink}>See All ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={styles.qaCard}
          onPress={() => router.push('/slab/add')}
          activeOpacity={0.8}
        >
          <View style={styles.qaIconCircle}>
            <MaterialCommunityIcons name="office-building" size={22} color={Colors.primary} />
          </View>
          <View style={styles.qaTextWrap}>
            <Text style={styles.qaTitle}>Add Slab</Text>
            <Text style={styles.qaSub}>Log new slab</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.qaCard}
          onPress={() => router.push('/sale/add')}
          activeOpacity={0.8}
        >
          <View style={styles.qaIconCircle}>
            <MaterialCommunityIcons name="package-variant-closed" size={22} color={Colors.primary} />
          </View>
          <View style={styles.qaTextWrap}>
            <Text style={styles.qaTitle}>Add Sale</Text>
            <Text style={styles.qaSub}>Record sales</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.qaCard}
          onPress={() => router.push('/meeting/add')}
          activeOpacity={0.8}
        >
          <View style={styles.qaIconCircle}>
            <Ionicons name="people" size={22} color={Colors.primary} />
          </View>
          <View style={styles.qaTextWrap}>
            <Text style={styles.qaTitle}>Add Meeting</Text>
            <Text style={styles.qaSub}>Plan or log</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── TODAY'S SCHEDULE ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/slab')}>
          <Text style={styles.seeAllLink}>View All ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scheduleRow}>
        {/* Left Schedule Card: Slabs Today */}
        <TouchableOpacity
          style={styles.scheduleCard}
          onPress={() => router.push('/(tabs)/slab')}
          activeOpacity={0.9}
        >
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleIconWrap}>
              <MaterialCommunityIcons name="office-building" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.scheduleTitle}>Slabs Today</Text>
              <Text style={styles.scheduleSubTitle}>2 Scheduled</Text>
            </View>
            <Feather name="chevron-right" size={16} color={Colors.textMuted} />
          </View>

          <View style={styles.scheduleItem}>
            <View style={styles.scheduleItemIcon}>
              <MaterialCommunityIcons name="home-city-outline" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduleItemName} numberOfLines={1}>Maa Mangala Store</Text>
              <Text style={styles.scheduleItemDetail}>9 bags • Ramesh Contractor</Text>
            </View>
          </View>

          <View style={styles.scheduleItem}>
            <View style={styles.scheduleItemIcon}>
              <MaterialCommunityIcons name="home-city-outline" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduleItemName} numberOfLines={1}>Shree Traders</Text>
              <Text style={styles.scheduleItemDetail}>12 bags • S.K. Construction</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Right Schedule Card: Meetings Today */}
        <TouchableOpacity
          style={styles.scheduleCard}
          onPress={() => router.push('/(tabs)/meeting')}
          activeOpacity={0.9}
        >
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleIconWrap}>
              <Ionicons name="people" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.scheduleTitle}>Meetings Today</Text>
              <Text style={styles.scheduleSubTitle}>1 Scheduled</Text>
            </View>
            <Feather name="chevron-right" size={16} color={Colors.textMuted} />
          </View>

          <View style={styles.scheduleItem}>
            <View style={styles.scheduleItemIcon}>
              <MaterialCommunityIcons name="account-group-outline" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduleItemName} numberOfLines={1}>Meeting with Contractor</Text>
              <Text style={styles.scheduleItemDetail}>Brahmapur Road</Text>
              <Text style={styles.scheduleItemDetail}>2:00 PM • 5 People</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── MONTHLY PERFORMANCE ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Monthly Performance</Text>
        <TouchableOpacity style={styles.dropdownBtn}>
          <Text style={styles.dropdownBtnText}>{selectedMonth}</Text>
          <Feather name="chevron-down" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.performanceRow}>
        {/* Sales Progress */}
        <View style={styles.perfCard}>
          <View style={styles.perfHeader}>
            <MaterialCommunityIcons name="chart-bar" size={16} color={Colors.primary} />
            <Text style={styles.perfLabel}>Sales</Text>
          </View>
          <Text style={styles.perfRatio}><Text style={styles.perfBold}>8,400</Text> / 10,000</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '84%' }]} />
          </View>
          <Text style={styles.perfPercent}>84%</Text>
        </View>

        {/* Active Punch Progress */}
        <View style={styles.perfCard}>
          <View style={styles.perfHeader}>
            <MaterialCommunityIcons name="pulse" size={16} color={Colors.primary} />
            <Text style={styles.perfLabel}>Active Punch</Text>
          </View>
          <Text style={styles.perfRatio}><Text style={styles.perfBold}>6,720</Text> / 8,400</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '80%' }]} />
          </View>
          <Text style={styles.perfPercent}>80%</Text>
        </View>

        {/* Meetings Progress */}
        <View style={styles.perfCard}>
          <View style={styles.perfHeader}>
            <Ionicons name="people" size={16} color={Colors.primary} />
            <Text style={styles.perfLabel}>Meetings</Text>
          </View>
          <Text style={styles.perfRatio}><Text style={styles.perfBold}>28</Text> / 50</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '56%' }]} />
          </View>
          <Text style={styles.perfPercent}>56%</Text>
        </View>
      </View>

      {/* ── DEALER SALES LEADERBOARD (MTD) ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Dealer Sales Leaderboard (MTD)</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/sales')}>
          <Text style={styles.seeAllLink}>View All ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.leaderboardCard}>
        {/* Row 1 - Gold */}
        <View style={styles.leaderRow}>
          <View style={[styles.rankCircle, styles.goldCircle]}>
            <Text style={styles.rankNumberGold}>1</Text>
          </View>
          <Text style={styles.dealerLeaderName}>Maa Mangala Store</Text>
          <Text style={styles.dealerBags}>1,250 Bags</Text>
          <View style={styles.trendRowGreen}>
            <Feather name="arrow-up" size={12} color="#16A34A" />
            <Text style={styles.trendPercentGreen}>12%</Text>
          </View>
        </View>

        {/* Row 2 - Silver */}
        <View style={styles.leaderRow}>
          <View style={[styles.rankCircle, styles.silverCircle]}>
            <Text style={styles.rankNumberSilver}>2</Text>
          </View>
          <Text style={styles.dealerLeaderName}>Shree Traders</Text>
          <Text style={styles.dealerBags}>980 Bags</Text>
          <View style={styles.trendRowGreen}>
            <Feather name="arrow-up" size={12} color="#16A34A" />
            <Text style={styles.trendPercentGreen}>8%</Text>
          </View>
        </View>

        {/* Row 3 - Bronze */}
        <View style={[styles.leaderRow, { borderBottomWidth: 0 }]}>
          <View style={[styles.rankCircle, styles.bronzeCircle]}>
            <Text style={styles.rankNumberBronze}>3</Text>
          </View>
          <Text style={styles.dealerLeaderName}>Jajpur Cement House</Text>
          <Text style={styles.dealerBags}>850 Bags</Text>
          <View style={styles.trendRowGreen}>
            <Feather name="arrow-up" size={12} color="#16A34A" />
            <Text style={styles.trendPercentGreen}>5%</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 30,
  },

  // Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greetingText: {
    fontSize: 13,
    color: '#8A7277',
    fontWeight: '500',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F0B10',
    letterSpacing: -0.3,
  },
  handWave: {
    fontSize: 20,
  },
  teamTerritory: {
    fontSize: 12,
    color: '#800E20',
    fontWeight: '600',
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
    shadowColor: 'rgba(78, 5, 17, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0E2E5',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#DC2626',
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
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#E8D5DA',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#800E20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#4A0611',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: 'rgba(78, 5, 17, 0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroOverlayLeft: {
    flex: 1.2,
    zIndex: 2,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBrandTE: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroBrandCONNECT: {
    fontSize: 24,
    fontWeight: '900',
    color: '#E53935',
    letterSpacing: 0.5,
  },
  heroTeamJajpur: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  heroTaglineContainer: {
    marginTop: 14,
  },
  heroTagline: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.8,
  },

  heroRightGraphic: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heroSubBadge: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  heroSubBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1.2,
    textAlign: 'right',
  },
  cementBagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cementBag: {
    width: 44,
    height: 52,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  f2rBag: {
    backgroundColor: '#C91F2B',
  },
  goldBag: {
    backgroundColor: '#8B1528',
    borderColor: '#D4AF37',
  },
  bagBrand: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  bagModel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  bagModelGold: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },

  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8D5DA',
  },
  activeDot: {
    width: 18,
    backgroundColor: '#800E20',
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 10,
  },
  sectionTitleMain: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0E2E5',
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#554246',
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#800E20',
  },

  // 4 Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0E2E5',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F0B10',
  },
  metricLabel: {
    fontSize: 10,
    color: '#8A7277',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  trendTextGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  trendTextRed: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Quick Actions Row
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  qaCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0E2E5',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  qaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  qaTextWrap: {
    flex: 1,
  },
  qaTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F0B10',
  },
  qaSub: {
    fontSize: 9,
    color: '#8A7277',
    marginTop: 1,
  },

  // Today's Schedule Row
  scheduleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  scheduleCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0E2E5',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  scheduleIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F0B10',
  },
  scheduleSubTitle: {
    fontSize: 9,
    color: '#8A7277',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  scheduleItemIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#FDF2F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginTop: 2,
  },
  scheduleItemName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F0B10',
  },
  scheduleItemDetail: {
    fontSize: 9,
    color: '#8A7277',
    marginTop: 1,
  },

  // Monthly Performance Row
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E2E5',
    gap: 4,
  },
  dropdownBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F0B10',
  },
  performanceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  perfCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F0E2E5',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  perfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  perfLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F0B10',
  },
  perfRatio: {
    fontSize: 10,
    color: '#8A7277',
    marginBottom: 6,
  },
  perfBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F0B10',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F5E8EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#800E20',
    borderRadius: 3,
  },
  perfPercent: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1F0B10',
    textAlign: 'right',
  },

  // Dealer Sales Leaderboard
  leaderboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F0E2E5',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  rankCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  goldCircle: {
    backgroundColor: '#FBBF24',
  },
  silverCircle: {
    backgroundColor: '#CBD5E1',
  },
  bronzeCircle: {
    backgroundColor: '#FDBA74',
  },
  rankNumberGold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350F',
  },
  rankNumberSilver: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  rankNumberBronze: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C2D12',
  },
  dealerLeaderName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1F0B10',
  },
  dealerBags: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B4E55',
    marginRight: 8,
  },
  trendRowGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendPercentGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
});
