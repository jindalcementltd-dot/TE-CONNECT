import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import {
  apiGetSales, apiGetDealers, apiGetActiveTracker, apiGetSettings,
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import {
  bagsToMT, currentMonthISO, formatPercent,
  calcRequiredPunch, calcActivePercent, calcGap, normalizeDate,
} from '../../src/utils/helpers';
import { Sale, DealerSalesSummary, TEActiveSummary } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function SalesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'TODAY'>('ALL');
  const today = normalizeDate(new Date());

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: apiGetSettings,
  });

  const { data: allSales, refetch: refetchSales } = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiGetSales(),
  });

  const { data: dealers, refetch: refetchDealers } = useQuery({
    queryKey: ['dealers'],
    queryFn: () => apiGetDealers(),
  });

  const { data: activeTrackers, refetch: refetchTrackers } = useQuery({
    queryKey: ['activeTrackers'],
    queryFn: () => apiGetActiveTracker(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSales(), refetchDealers(), refetchTrackers()]);
    setRefreshing(false);
  }, []);

  const activeTarget = Number(settings?.find(s => s.setting === 'active_target')?.value || 80);
  const salesList = allSales || [];

  // Filter sales
  const filteredSales = filter === 'TODAY'
    ? salesList.filter(s => normalizeDate(s.sale_date) === today)
    : salesList;

  const totalBags = filteredSales.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const totalMT = (totalBags / 20).toFixed(1);
  const f2rBags = filteredSales.filter(s => String(s.product).includes('F2R')).reduce((sum, s) => sum + Number(s.quantity_bags || 0), 0);
  const goldBags = filteredSales.filter(s => String(s.product).includes('GOLD')).reduce((sum, s) => sum + Number(s.quantity_bags || 0), 0);

  // Active / Punch Calculations
  const totalPunchBags = (activeTrackers || []).reduce((sum, t) => sum + (Number(t.punched_quantity_bags) || 0), 0);
  const totalSalesBagsAll = salesList.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const requiredPunch = calcRequiredPunch(totalSalesBagsAll, activeTarget);
  const activePercent = totalSalesBagsAll > 0 ? Math.round((totalPunchBags / totalSalesBagsAll) * 100) : 0;
  const punchGap = calcGap(requiredPunch, totalPunchBags);

  // Dealer Leaderboard computation
  const dealerMap: Record<string, { dealer_id: string; dealer_name: string; area: string; total_bags: number; f2r: number; gold: number }> = {};
  
  (dealers || []).forEach(d => {
    dealerMap[d.dealer_id] = {
      dealer_id: d.dealer_id,
      dealer_name: d.dealer_name,
      area: d.area || 'Jajpur',
      total_bags: 0,
      f2r: 0,
      gold: 0,
    };
  });

  salesList.forEach(s => {
    const did = s.dealer_id || s.dealer_name;
    if (!dealerMap[did]) {
      dealerMap[did] = {
        dealer_id: did,
        dealer_name: s.dealer_name,
        area: 'Jajpur',
        total_bags: 0,
        f2r: 0,
        gold: 0,
      };
    }
    const q = Number(s.quantity_bags) || 0;
    dealerMap[did].total_bags += q;
    if (String(s.product).includes('F2R')) dealerMap[did].f2r += q;
    if (String(s.product).includes('GOLD')) dealerMap[did].gold += q;
  });

  const rankedDealers = Object.values(dealerMap)
    .filter(d => d.total_bags > 0)
    .sort((a, b) => b.total_bags - a.total_bags);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Sales & Active</Text>
          <Text style={styles.headerSub}>Team Jajpur Performance</Text>
        </View>
        <TouchableOpacity
          style={styles.addSaleBtn}
          onPress={() => router.push('/sale/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addSaleBtnText}>Add Sale</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#800E20" />}
      >
        {/* ── 1. BIG SALES HERO CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>TOTAL SALES ({filter === 'TODAY' ? 'TODAY' : 'THIS MONTH'})</Text>
              <Text style={styles.heroValueMT}>{totalMT} <Text style={styles.heroUnit}>MT</Text></Text>
              <Text style={styles.heroBagsSub}>{totalBags} Total Bags Logged</Text>
            </View>
            <View style={styles.heroBadgeIcon}>
              <MaterialCommunityIcons name="chart-box" size={32} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.heroDivider} />

          {/* Product Breakdown */}
          <View style={styles.productRow}>
            <View style={styles.productCol}>
              <View style={[styles.productDot, { backgroundColor: '#E53935' }]} />
              <View>
                <Text style={styles.productLabel}>ACC F2R</Text>
                <Text style={styles.productValue}>{f2rBags} bags ({(f2rBags / 20).toFixed(1)} MT)</Text>
              </View>
            </View>

            <View style={styles.productCol}>
              <View style={[styles.productDot, { backgroundColor: '#F59E0B' }]} />
              <View>
                <Text style={styles.productLabel}>ACC GOLD</Text>
                <Text style={styles.productValue}>{goldBags} bags ({(goldBags / 20).toFixed(1)} MT)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 2. ACTIVE PUNCH CARD ── */}
        <View style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <View style={styles.activeIconCircle}>
              <MaterialCommunityIcons name="target" size={22} color="#15803D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>Active % Punching Tracker</Text>
              <Text style={styles.activeSub}>Monthly Active Target: {activeTarget}%</Text>
            </View>
            <Text style={[styles.activeScoreText, { color: activePercent >= activeTarget ? '#15803D' : '#800E20' }]}>
              {activePercent}%
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.min(activePercent, 100)}%` as any }]} />
          </View>

          <View style={styles.activeStatsRow}>
            <View style={styles.activeStat}>
              <Text style={styles.activeStatVal}>{totalPunchBags} bg</Text>
              <Text style={styles.activeStatLbl}>Actual Punch</Text>
            </View>
            <View style={styles.activeStat}>
              <Text style={styles.activeStatVal}>{requiredPunch} bg</Text>
              <Text style={styles.activeStatLbl}>Required Punch</Text>
            </View>
            <View style={styles.activeStat}>
              <Text style={[styles.activeStatVal, { color: punchGap > 0 ? '#DC2626' : '#15803D' }]}>
                {punchGap > 0 ? `${punchGap} bg gap` : 'Target Met'}
              </Text>
              <Text style={styles.activeStatLbl}>Gap to Target</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.recordPunchBtn}
            onPress={() => router.push({ pathname: '/sale/add', params: { type: 'punch' } })}
            activeOpacity={0.85}
          >
            <Feather name="plus-circle" size={16} color="#800E20" style={{ marginRight: 6 }} />
            <Text style={styles.recordPunchBtnText}>+ Record Active Punch</Text>
          </TouchableOpacity>
        </View>

        {/* ── 3. FILTER TABS ── */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'ALL' && styles.filterTabActive]}
            onPress={() => setFilter('ALL')}
          >
            <Text style={[styles.filterTabText, filter === 'ALL' && styles.filterTabTextActive]}>All Sales ({salesList.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === 'TODAY' && styles.filterTabActive]}
            onPress={() => setFilter('TODAY')}
          >
            <Text style={[styles.filterTabText, filter === 'TODAY' && styles.filterTabTextActive]}>Today's Sales</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. DEALER LEADERBOARD ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Dealer Leaderboard</Text>
          <Text style={styles.sectionHeaderCount}>{rankedDealers.length} Active</Text>
        </View>

        {rankedDealers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Dealer Sales Recorded</Text>
            <Text style={styles.emptySub}>Add a sale to see dealer sales leaderboard ranking here.</Text>
          </View>
        ) : (
          <View style={styles.leaderboardContainer}>
            {rankedDealers.map((d, idx) => (
              <View key={d.dealer_id} style={[styles.dealerRow, idx === rankedDealers.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.rankBadge, idx === 0 ? styles.rankGold : idx === 1 ? styles.rankSilver : styles.rankBronze]}>
                  <Text style={styles.rankBadgeText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dealerName}>{d.dealer_name}</Text>
                  <Text style={styles.dealerArea}>{d.area} • F2R: {d.f2r} | Gold: {d.gold}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.dealerMT}>{(d.total_bags / 20).toFixed(1)} MT</Text>
                  <Text style={styles.dealerBags}>{d.total_bags} bags</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── 5. RECENT SALES TRANSACTIONS ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionHeaderTitle}>Sales Log ({filteredSales.length})</Text>
          <TouchableOpacity onPress={() => onRefresh()}>
            <Text style={styles.refreshLink}>Refresh ⟳</Text>
          </TouchableOpacity>
        </View>

        {filteredSales.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Sales Entries Found</Text>
            <Text style={styles.emptySub}>Tap '+ Add Sale' above to record a new sale in Google Sheets.</Text>
          </View>
        ) : (
          <View style={styles.salesList}>
            {filteredSales.map((sale) => (
              <View key={sale.sale_id} style={styles.saleTransactionCard}>
                <View style={styles.saleIconBox}>
                  <MaterialCommunityIcons name="package-variant-closed" size={22} color="#800E20" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.saleDealer}>{sale.dealer_name}</Text>
                  <Text style={styles.saleProduct}>{sale.product} • Logged by {sale.created_by || 'Admin'}</Text>
                  <Text style={styles.saleDateText}>{normalizeDate(sale.sale_date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.saleQuantity}>{sale.quantity_bags} Bags</Text>
                  <Text style={styles.saleMT}>{(Number(sale.quantity_bags) / 20).toFixed(1)} MT</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#8A7277',
    fontWeight: '500',
    marginTop: 2,
  },
  addSaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#800E20',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    gap: 4,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  addSaleBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#4A0611',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1,
  },
  heroValueMT: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E53935',
  },
  heroBagsSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginTop: 2,
  },
  heroBadgeIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 16,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  productLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  productValue: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
  },

  // Active Punch Card
  activeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 20,
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  activeSub: {
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
  },
  activeScoreText: {
    fontSize: 22,
    fontWeight: '900',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#F5E8EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#15803D',
    borderRadius: 4,
  },
  activeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingTop: 4,
  },
  activeStat: {
    alignItems: 'center',
  },
  activeStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F0B10',
  },
  activeStatLbl: {
    fontSize: 10,
    color: '#8A7277',
    marginTop: 2,
  },
  recordPunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBE8EC',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D5DA',
  },
  recordPunchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#800E20',
  },

  // Filter Tabs
  filterTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  filterTabActive: {
    backgroundColor: '#800E20',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A7277',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F0B10',
    letterSpacing: -0.3,
  },
  sectionHeaderCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#800E20',
  },
  refreshLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#800E20',
  },

  // Leaderboard
  leaderboardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 20,
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  dealerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  dealerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  dealerArea: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
  dealerMT: {
    fontSize: 15,
    fontWeight: '900',
    color: '#800E20',
  },
  dealerBags: {
    fontSize: 11,
    color: '#8A7277',
  },

  // Recent Sales List
  salesList: {
    gap: 10,
  },
  saleTransactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  saleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  saleDealer: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F0B10',
  },
  saleProduct: {
    fontSize: 12,
    color: '#6B4E55',
    marginTop: 2,
  },
  saleDateText: {
    fontSize: 10,
    color: '#8A7277',
    marginTop: 2,
  },
  saleQuantity: {
    fontSize: 15,
    fontWeight: '900',
    color: '#800E20',
  },
  saleMT: {
    fontSize: 11,
    color: '#8A7277',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F0B10',
  },
  emptySub: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
  },
});
