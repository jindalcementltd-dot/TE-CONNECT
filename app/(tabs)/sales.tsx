import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions, Platform, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import {
  apiGetSales, apiGetDealers, apiGetActiveTracker, apiGetSettings, apiGetContractors,
} from '../../src/services/api';
import {
  bagsToMT, currentMonthISO, formatPercent,
  calcRequiredPunch, calcActivePercent, calcGap, normalizeDate,
  PUNCH_VOLUME_TARGET_PERCENT, CONTRACTOR_ACTIVE_MIN_TARGET_PERCENT,
  simulateContractorPunchDistribution, calcContractorActivePercent,
  calcRequiredActiveContractors,
} from '../../src/utils/helpers';
import { Sale, DealerSalesSummary } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const PRESET_BAG_RATES = [50, 80, 90, 100, 120];

export default function SalesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'TODAY'>('ALL');
  const [selectedBagRate, setSelectedBagRate] = useState<number>(100);
  const [customBagRateInput, setCustomBagRateInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

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

  const { data: contractors, refetch: refetchContractors } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => apiGetContractors(),
  });

  const { data: activeTrackers, refetch: refetchTrackers } = useQuery({
    queryKey: ['activeTrackers'],
    queryFn: () => apiGetActiveTracker(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSales(),
      refetchDealers(),
      refetchContractors(),
      refetchTrackers(),
    ]);
    setRefreshing(false);
  }, [refetchSales, refetchDealers, refetchContractors, refetchTrackers]);

  const salesList = useMemo(() => allSales || [], [allSales]);

  // Filter sales
  const filteredSales = filter === 'TODAY'
    ? salesList.filter(s => normalizeDate(s.sale_date) === today)
    : salesList;

  // 1. Total Sales Volume
  const totalBags = filteredSales.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const totalMT = (totalBags / 20).toFixed(1);
  const f2rBags = filteredSales.filter(s => String(s.product).includes('F2R')).reduce((sum, s) => sum + Number(s.quantity_bags || 0), 0);
  const goldBags = filteredSales.filter(s => String(s.product).includes('GOLD')).reduce((sum, s) => sum + Number(s.quantity_bags || 0), 0);

  // 2. Volume (Bag) Punch calculations (80% Target)
  const totalSalesBagsAll = salesList.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const totalPunchBags = (activeTrackers || []).reduce((sum, t) => sum + (Number(t.punched_quantity_bags) || 0), 0);
  
  const required80PercentPunchBags = calcRequiredPunch(totalSalesBagsAll, PUNCH_VOLUME_TARGET_PERCENT);
  const punchVolumePercent = totalSalesBagsAll > 0
    ? Math.round((totalPunchBags / totalSalesBagsAll) * 1000) / 10
    : 0;
  const punchGapBags = calcGap(required80PercentPunchBags, totalPunchBags);

  // 3. Contractor Active % calculations (40% Minimum Target)
  // Total contractors from Sheet or contractors list
  const sheetTotalContractors = (activeTrackers || []).reduce((max, t) => Math.max(max, Number(t.total_contractors) || 0), 0);
  const totalContractorsCount = sheetTotalContractors > 0
    ? sheetTotalContractors
    : Math.max((contractors || []).length, 10); // Default to live contractors or base 10

  const sheetActiveContractors = (activeTrackers || []).reduce((sum, t) => sum + (Number(t.active_contractors) || 0), 0);
  const activeContractorsCount = sheetActiveContractors > 0
    ? sheetActiveContractors
    : (totalPunchBags > 0 ? Math.ceil(totalPunchBags / 100) : 0);

  const contractorActivePercent = calcContractorActivePercent(activeContractorsCount, totalContractorsCount);
  const required40PercentContractors = calcRequiredActiveContractors(totalContractorsCount, CONTRACTOR_ACTIVE_MIN_TARGET_PERCENT);
  const contractorShortfall = Math.max(0, required40PercentContractors - activeContractorsCount);

  // 4. Interactive Contractor Punch Distribution Simulator
  const effectiveBagRate = isCustomMode
    ? (Number(customBagRateInput) || 100)
    : selectedBagRate;

  const simulation = useMemo(() => {
    return simulateContractorPunchDistribution(
      totalSalesBagsAll,
      totalContractorsCount,
      effectiveBagRate
    );
  }, [totalSalesBagsAll, totalContractorsCount, effectiveBagRate]);

  // 5. Dealer Leaderboard computation
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
          <Text style={styles.headerSub}>Team Jajpur Performance Command</Text>
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
        {/* ── 1. PROTON VAULT WINE GLASS HERO CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>TOTAL SALES VOLUME ({filter === 'TODAY' ? 'TODAY' : 'THIS MONTH'})</Text>
              <Text style={styles.heroValueMT}>{totalMT} <Text style={styles.heroUnit}>MT</Text></Text>
              <Text style={styles.heroBagsSub}>{totalBags} Total Bags Logged in Google Sheet</Text>
            </View>
            <View style={styles.heroBadgeIcon}>
              <MaterialCommunityIcons name="chart-box" size={32} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.heroDivider} />

          {/* Product Breakdown Badges */}
          <View style={styles.productRow}>
            <View style={styles.productGlassPill}>
              <View style={[styles.productDot, { backgroundColor: '#E53935' }]} />
              <View>
                <Text style={styles.productLabel}>ACC F2R</Text>
                <Text style={styles.productValue}>{f2rBags} bags ({(f2rBags / 20).toFixed(1)} MT)</Text>
              </View>
            </View>

            <View style={styles.productGlassPill}>
              <View style={[styles.productDot, { backgroundColor: '#F59E0B' }]} />
              <View>
                <Text style={styles.productLabel}>ACC GOLD</Text>
                <Text style={styles.productValue}>{goldBags} bags ({(goldBags / 20).toFixed(1)} MT)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 2. DUAL BUSINESS PERFORMANCE TARGETS ── */}
        <View style={styles.targetsTwinRow}>
          {/* Target 1: 80% Bag Volume Punch */}
          <View style={styles.targetGlassCard}>
            <View style={styles.targetCardHeader}>
              <View style={[styles.targetIconBox, { backgroundColor: '#FBE8EC' }]}>
                <MaterialCommunityIcons name="cube-send" size={20} color="#800E20" />
              </View>
              <View style={styles.targetBadgePill}>
                <Text style={styles.targetBadgeText}>Target: {PUNCH_VOLUME_TARGET_PERCENT}%</Text>
              </View>
            </View>

            <Text style={styles.targetCardTitle}>Bag Volume Punch</Text>
            <Text style={styles.targetCardSub}>80% of total sales bags</Text>

            <View style={styles.targetScoreRow}>
              <Text style={[styles.targetScoreVal, { color: punchVolumePercent >= 80 ? '#15803D' : '#800E20' }]}>
                {punchVolumePercent}%
              </Text>
              <Text style={styles.targetScoreSub}>
                {totalPunchBags} / {required80PercentPunchBags} Bags
              </Text>
            </View>

            <View style={styles.miniProgressBarTrack}>
              <View style={[
                styles.miniProgressBarFill,
                {
                  width: `${Math.min(punchVolumePercent, 100)}%` as any,
                  backgroundColor: punchVolumePercent >= 80 ? '#15803D' : '#800E20',
                }
              ]} />
            </View>

            <Text style={[styles.targetGapText, { color: punchGapBags > 0 ? '#DC2626' : '#15803D' }]}>
              {punchGapBags > 0 ? `⚠️ Gap: ${punchGapBags} bags left` : '✅ 80% Volume Target Met'}
            </Text>
          </View>

          {/* Target 2: 40% Contractor Active Base */}
          <View style={styles.targetGlassCard}>
            <View style={styles.targetCardHeader}>
              <View style={[styles.targetIconBox, { backgroundColor: '#DCFCE7' }]}>
                <MaterialCommunityIcons name="account-hard-hat" size={20} color="#15803D" />
              </View>
              <View style={[styles.targetBadgePill, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.targetBadgeText, { color: '#15803D' }]}>Min: {CONTRACTOR_ACTIVE_MIN_TARGET_PERCENT}%</Text>
              </View>
            </View>

            <Text style={styles.targetCardTitle}>Contractor Active</Text>
            <Text style={styles.targetCardSub}>Min 40% active contractors</Text>

            <View style={styles.targetScoreRow}>
              <Text style={[styles.targetScoreVal, { color: contractorActivePercent >= 40 ? '#15803D' : '#D97706' }]}>
                {contractorActivePercent.toFixed(1)}%
              </Text>
              <Text style={styles.targetScoreSub}>
                {activeContractorsCount} / {totalContractorsCount} Active
              </Text>
            </View>

            <View style={styles.miniProgressBarTrack}>
              <View style={[
                styles.miniProgressBarFill,
                {
                  width: `${Math.min(contractorActivePercent, 100)}%` as any,
                  backgroundColor: contractorActivePercent >= 40 ? '#15803D' : '#D97706',
                }
              ]} />
            </View>

            <Text style={[styles.targetGapText, { color: contractorShortfall > 0 ? '#D97706' : '#15803D' }]}>
              {contractorShortfall > 0 ? `⚠️ Need ${contractorShortfall} more active` : '✅ 40% Active Target Met'}
            </Text>
          </View>
        </View>

        {/* ── 3. INTERACTIVE CONTRACTOR PUNCH PLANNER & SIMULATOR ── */}
        <View style={styles.simulatorCard}>
          <View style={styles.simulatorHeader}>
            <View style={styles.simIconBox}>
              <MaterialCommunityIcons name="calculator-variant" size={24} color="#800E20" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.simTitle}>Contractor Punch Planner & Simulator</Text>
              <Text style={styles.simSub}>
                Calculate how many contractors to punch to achieve the 80% volume & 40% active target
              </Text>
            </View>
          </View>

          {/* Preset Buttons */}
          <View style={styles.presetSection}>
            <Text style={styles.presetLabel}>Select Bags Per Contractor:</Text>
            <View style={styles.presetButtonsRow}>
              {PRESET_BAG_RATES.map((rate) => {
                const isSelected = !isCustomMode && selectedBagRate === rate;
                return (
                  <TouchableOpacity
                    key={rate}
                    style={[styles.presetChip, isSelected && styles.presetChipActive]}
                    onPress={() => {
                      setIsCustomMode(false);
                      setSelectedBagRate(rate);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                      {rate} Bags
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.presetChip, isCustomMode && styles.presetChipActive]}
                onPress={() => setIsCustomMode(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.presetChipText, isCustomMode && styles.presetChipTextActive]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {isCustomMode && (
              <View style={styles.customInputRow}>
                <Text style={styles.customInputLabel}>Enter Bags per Contractor:</Text>
                <TextInput
                  style={styles.customInput}
                  value={customBagRateInput}
                  onChangeText={setCustomBagRateInput}
                  placeholder="e.g. 75"
                  keyboardType="numeric"
                  placeholderTextColor="#A0858C"
                />
              </View>
            )}
          </View>

          {/* Live Simulator Calculation Box */}
          <View style={styles.simResultBox}>
            <View style={styles.simResultTop}>
              <View>
                <Text style={styles.simResultHeading}>Simulation Result @ {simulation.bagRate} Bags/Contractor</Text>
                <Text style={styles.simResultSub}>
                  Total 80% Punch Target = <Text style={{ fontWeight: '800', color: '#800E20' }}>{simulation.punchTargetBags} Bags</Text> ({totalMT} MT Total Sales)
                </Text>
              </View>
              <View style={[
                styles.simStatusPill,
                simulation.isContractorTargetMet ? styles.simStatusPillSuccess : styles.simStatusPillWarn
              ]}>
                <Text style={[
                  styles.simStatusPillText,
                  simulation.isContractorTargetMet ? { color: '#15803D' } : { color: '#B45309' }
                ]}>
                  {simulation.isContractorTargetMet ? '✅ 40% Target MET' : `⚠️ ${simulation.contractorShortfall} Shortfall`}
                </Text>
              </View>
            </View>

            <View style={styles.simMetrics3Col}>
              <View style={styles.simMetricItem}>
                <Text style={styles.simMetricValue}>{simulation.activatedContractors}</Text>
                <Text style={styles.simMetricLabel}>Contractors Covered</Text>
              </View>

              <View style={styles.simMetricSeparator} />

              <View style={styles.simMetricItem}>
                <Text style={[
                  styles.simMetricValue,
                  { color: simulation.isContractorTargetMet ? '#15803D' : '#D97706' }
                ]}>
                  {simulation.activePercentAchieved}%
                </Text>
                <Text style={styles.simMetricLabel}>Active % Achieved</Text>
              </View>

              <View style={styles.simMetricSeparator} />

              <View style={styles.simMetricItem}>
                <Text style={styles.simMetricValue}>{simulation.minActiveContractorTarget}</Text>
                <Text style={styles.simMetricLabel}>40% Min Required</Text>
              </View>
            </View>

            {/* Distribution Breakdown Visual */}
            <View style={styles.distributionVisualBox}>
              <Text style={styles.distVisualTitle}>📋 Recommended Punch Allocation:</Text>
              
              {simulation.fullContractors > 0 ? (
                <View style={styles.distRow}>
                  <View style={styles.distBullet} />
                  <Text style={styles.distText}>
                    <Text style={{ fontWeight: '800', color: '#1F0B10' }}>{simulation.fullContractors} Contractors</Text> × {simulation.bagRate} Bags = <Text style={{ fontWeight: '800', color: '#800E20' }}>{simulation.fullContractors * simulation.bagRate} Bags</Text>
                  </Text>
                </View>
              ) : null}

              {simulation.remainderBags > 0 ? (
                <View style={styles.distRow}>
                  <View style={[styles.distBullet, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.distText}>
                    <Text style={{ fontWeight: '800', color: '#1F0B10' }}>1 Contractor</Text> × {simulation.remainderBags} Bags (Remainder Slot) = <Text style={{ fontWeight: '800', color: '#800E20' }}>{simulation.remainderBags} Bags</Text>
                  </Text>
                </View>
              ) : null}

              <View style={styles.distTotalRow}>
                <Text style={styles.distTotalLabel}>Total Punch Target:</Text>
                <Text style={styles.distTotalVal}>{simulation.punchTargetBags} Bags (80% of Sales)</Text>
              </View>
            </View>
          </View>

          {/* Quick Record Punch Action Button */}
          <TouchableOpacity
            style={styles.simActionBtn}
            onPress={() => router.push({ pathname: '/sale/add', params: { type: 'punch' } })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.simActionBtnText}>Record Contractor Punch in Google Sheet</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. FILTER TABS ── */}
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

        {/* ── 5. DEALER LEADERBOARD ── */}
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

        {/* ── 6. RECENT SALES TRANSACTIONS ── */}
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

  // 1. Hero Card
  heroCard: {
    backgroundColor: '#4A0611',
    borderRadius: 26,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 16,
  },
  productRow: {
    flexDirection: 'row',
    gap: 10,
  },
  productGlassPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
    fontWeight: '600',
  },

  // 2. Dual Target Cards
  targetsTwinRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  targetGlassCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  targetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  targetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBadgePill: {
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  targetBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#800E20',
  },
  targetCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F0B10',
  },
  targetCardSub: {
    fontSize: 10,
    color: '#8A7277',
    marginBottom: 8,
  },
  targetScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  targetScoreVal: {
    fontSize: 22,
    fontWeight: '900',
  },
  targetScoreSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A7277',
  },
  miniProgressBarTrack: {
    height: 6,
    backgroundColor: '#F5E8EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  miniProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  targetGapText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // 3. Simulator Card
  simulatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 20,
    shadowColor: 'rgba(78, 5, 17, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  simulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  simIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F0B10',
  },
  simSub: {
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
    lineHeight: 16,
  },
  presetSection: {
    marginBottom: 16,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F0B10',
    marginBottom: 8,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#FAF6F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  presetChipActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F0B10',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  customInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#800E20',
  },
  customInput: {
    borderWidth: 1.5,
    borderColor: '#800E20',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#1F0B10',
    backgroundColor: '#FFFFFF',
    fontWeight: '700',
    width: 90,
  },
  simResultBox: {
    backgroundColor: '#FAF0F2',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0D5DA',
    marginBottom: 16,
  },
  simResultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  simResultHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F0B10',
  },
  simResultSub: {
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
  },
  simStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  simStatusPillSuccess: {
    backgroundColor: '#DCFCE7',
  },
  simStatusPillWarn: {
    backgroundColor: '#FEF3C7',
  },
  simStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  simMetrics3Col: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEDCE1',
    marginBottom: 12,
  },
  simMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  simMetricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F0B10',
  },
  simMetricLabel: {
    fontSize: 10,
    color: '#8A7277',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  simMetricSeparator: {
    width: 1,
    height: '80%',
    backgroundColor: '#F0E2E5',
    alignSelf: 'center',
  },
  distributionVisualBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  distVisualTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#800E20',
    marginBottom: 6,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 3,
  },
  distBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#800E20',
  },
  distText: {
    fontSize: 12,
    color: '#554246',
  },
  distTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F7EFF1',
  },
  distTotalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1F0B10',
  },
  distTotalVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#800E20',
  },
  simActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#800E20',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  simActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // 4. Filter Tabs
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
