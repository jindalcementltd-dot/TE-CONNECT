import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import {
  apiGetSales, apiGetDealerSalesSummary,
  apiGetTEActiveSummary, apiGetActiveTracker, apiGetTargets, apiGetSettings,
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import {
  bagsToMT, currentMonthISO, formatPercent,
  calcRequiredPunch, calcActivePercent, calcGap, sumBy, normalizeDate,
} from '../../src/utils/helpers';
import { Sale, DealerSalesSummary, TEActiveSummary } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { format, getDaysInMonth } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Sub-components ───────────────────────────────────────────

function MetricCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: string;
}) {
  return (
    <View style={[metricStyles.card, { borderLeftColor: color }]}>
      <Text style={metricStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={metricStyles.label}>{label}</Text>
        <Text style={[metricStyles.value, { color }]}>{value}</Text>
        {sub ? <Text style={metricStyles.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function DealerRow({ dealer, rank }: { dealer: DealerSalesSummary; rank: number }) {
  return (
    <View style={dealerStyles.row}>
      <Text style={dealerStyles.rank}>#{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={dealerStyles.name}>{dealer.dealer_name}</Text>
        <Text style={dealerStyles.area}>{dealer.area} · {dealer.assigned_te}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={dealerStyles.mt}>{dealer.total_mt.toFixed(2)} MT</Text>
        <View style={dealerStyles.productRow}>
          {dealer.f2r_bags > 0 && <Text style={dealerStyles.f2r}>F2R: {dealer.f2r_bags}</Text>}
          {dealer.gold_bags > 0 && <Text style={dealerStyles.gold}>Gold: {dealer.gold_bags}</Text>}
        </View>
      </View>
      <View style={[
        dealerStyles.activeBadge,
        { backgroundColor: (dealer.active === undefined || dealer.active === null || dealer.active === '' || String(dealer.active).toLowerCase() !== 'false') ? Colors.successLight : Colors.borderLight }
      ]}>
        <Text style={[
          dealerStyles.activeText,
          { color: (dealer.active === undefined || dealer.active === null || dealer.active === '' || String(dealer.active).toLowerCase() !== 'false') ? Colors.success : Colors.textMuted }
        ]}>
          {(dealer.active === undefined || dealer.active === null || dealer.active === '' || String(dealer.active).toLowerCase() !== 'false') ? 'ACTIVE' : 'INACTIVE'}
        </Text>
      </View>
    </View>
  );
}

function TEActiveRow({ te }: { te: TEActiveSummary }) {
  const pct = te.active_percent;
  const color = pct >= 80 ? Colors.success : pct >= 60 ? Colors.warning : Colors.error;
  return (
    <View style={teStyles.row}>
      <View style={teStyles.avatar}>
        <Text style={teStyles.avatarText}>{te.te.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={teStyles.name}>{te.te}</Text>
        <View style={teStyles.statsRow}>
          <Text style={teStyles.stat}>Sales: {te.total_sales_bags}bg</Text>
          <Text style={teStyles.stat}>Punch: {te.actual_punch_bags}bg</Text>
          <Text style={teStyles.stat}>Gap: {te.gap_bags}bg</Text>
        </View>
        <View style={teStyles.statsRow}>
          <Text style={teStyles.stat}>Contractors: {te.total_contractors}</Text>
          <Text style={[teStyles.stat, { color: Colors.success }]}>Active: {te.active_contractors}</Text>
          <Text style={[teStyles.stat, { color: Colors.error }]}>Inactive: {te.inactive_contractors}</Text>
        </View>
      </View>
      <Text style={[teStyles.percent, { color }]}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────

export default function SalesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'THIS_MONTH' | 'TODAY' | 'CUSTOM'>('THIS_MONTH');
  const month = currentMonthISO();
  const today = new Date().toISOString().split('T')[0];

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: apiGetSettings,
  });

  const { data: sales, refetch: refetchSales } = useQuery({
    queryKey: ['sales', month],
    queryFn: () => apiGetSales({ month }),
  });

  const { data: dealerSales, refetch: refetchDealerSales } = useQuery({
    queryKey: ['dealerSalesSummary', month],
    queryFn: () => apiGetDealerSalesSummary(month),
  });

  const { data: teActive, refetch: refetchTeActive } = useQuery({
    queryKey: ['teActiveSummary', month],
    queryFn: () => apiGetTEActiveSummary(month),
  });

  const { data: targets } = useQuery({
    queryKey: ['targets', month],
    queryFn: () => apiGetTargets({ month }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSales(), refetchDealerSales(), refetchTeActive()]);
    setRefreshing(false);
  }, []);

  // Compute totals
  const filteredSales = filter === 'TODAY'
    ? (sales || []).filter(s => normalizeDate(s.sale_date) === today)
    : (sales || []);

  const totalBags = sumBy(filteredSales, 'quantity_bags');
  const f2rBags = filteredSales.filter(s => s.product === 'ACC F2R').reduce((sum, s) => sum + Number(s.quantity_bags), 0);
  const goldBags = filteredSales.filter(s => s.product === 'ACC GOLD').reduce((sum, s) => sum + Number(s.quantity_bags), 0);
  const totalMT = bagsToMT(totalBags);

  // Active/Punch calculations
  const activeTarget = Number(settings?.find(s => s.setting === 'active_target')?.value || 80);
  const totalTeActive = teActive || [];
  const totalSalesBagsAll = totalTeActive.reduce((sum, te) => sum + te.total_sales_bags, 0);
  const totalPunchAll = totalTeActive.reduce((sum, te) => sum + te.actual_punch_bags, 0);
  const requiredPunchAll = calcRequiredPunch(totalSalesBagsAll, activeTarget);
  const activePercentAll = calcActivePercent(totalPunchAll, totalSalesBagsAll);
  const gapAll = calcGap(requiredPunchAll, totalPunchAll);

  // Daily sales chart data
  const daysInMonth = getDaysInMonth(new Date(month + '-01'));
  const dailyLabels: string[] = [];
  const dailyData: number[] = [];
  for (let d = 1; d <= Math.min(daysInMonth, 15); d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const dayBags = (sales || [])
      .filter(s => normalizeDate(s.sale_date) === dateStr)
      .reduce((sum, s) => sum + Number(s.quantity_bags), 0);
    dailyLabels.push(String(d));
    dailyData.push(dayBags);
  }

  const chartConfig = {
    backgroundColor: Colors.white,
    backgroundGradientFrom: Colors.white,
    backgroundGradientTo: Colors.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(201, 31, 43, ${opacity})`,
    labelColor: () => Colors.textSecondary,
    propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.primary },
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Sales</Text>
          <Text style={styles.headerSub}>Active / Punching</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/sale/add')}>
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>Add Sale</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={filterStyles.container}>
        {(['THIS_MONTH', 'TODAY'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[filterStyles.tab, filter === f && filterStyles.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[filterStyles.tabText, filter === f && filterStyles.tabTextActive]}>
              {f === 'THIS_MONTH' ? 'This Month' : 'Today'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total Sales */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>TOTAL SALES</Text>
        <Text style={styles.totalMT}>{totalMT.toFixed(2)} MT</Text>
        <Text style={styles.totalBags}>{totalBags.toLocaleString()} Bags</Text>
        <View style={productStyles.row}>
          <View style={productStyles.item}>
            <View style={[productStyles.dot, { backgroundColor: Colors.primary }]} />
            <View>
              <Text style={productStyles.name}>ACC F2R</Text>
              <Text style={productStyles.mt}>{bagsToMT(f2rBags).toFixed(2)} MT</Text>
              <Text style={productStyles.bags}>{f2rBags} Bags</Text>
            </View>
          </View>
          <View style={productStyles.divider} />
          <View style={productStyles.item}>
            <View style={[productStyles.dot, { backgroundColor: '#D97706' }]} />
            <View>
              <Text style={productStyles.name}>ACC GOLD</Text>
              <Text style={productStyles.mt}>{bagsToMT(goldBags).toFixed(2)} MT</Text>
              <Text style={productStyles.bags}>{goldBags} Bags</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Monthly Sales Chart */}
      {dailyData.some(d => d > 0) && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>DAILY SALES — {format(new Date(month + '-01'), 'MMMM yyyy')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={{ labels: dailyLabels, datasets: [{ data: dailyData }] }}
              width={Math.max(SCREEN_WIDTH - 64, dailyLabels.length * 28)}
              height={160}
              chartConfig={chartConfig}
              style={{ borderRadius: 12, marginTop: 8 }}
              showValuesOnTopOfBars
              yAxisLabel=""
              yAxisSuffix=""
            />
          </ScrollView>
        </View>
      )}

      {/* Active / Punching */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>ACTIVE / PUNCHING</Text>
          <Text style={styles.targetText}>Target: {activeTarget}%</Text>
        </View>
        <View style={activeStyles.grid}>
          <View style={activeStyles.cell}>
            <Text style={activeStyles.cellLabel}>Total Sales</Text>
            <Text style={activeStyles.cellValue}>{totalSalesBagsAll} Bags</Text>
          </View>
          <View style={activeStyles.cell}>
            <Text style={activeStyles.cellLabel}>Required Punch</Text>
            <Text style={activeStyles.cellValue}>{requiredPunchAll} Bags</Text>
          </View>
          <View style={activeStyles.cell}>
            <Text style={activeStyles.cellLabel}>Actual Punch</Text>
            <Text style={activeStyles.cellValue}>{totalPunchAll} Bags</Text>
          </View>
          <View style={[activeStyles.cell, activeStyles.highlightCell]}>
            <Text style={activeStyles.cellLabel}>Active %</Text>
            <Text style={[activeStyles.cellValue, {
              color: activePercentAll >= activeTarget ? Colors.success :
                activePercentAll >= activeTarget * 0.75 ? Colors.warning : Colors.error
            }]}>
              {formatPercent(activePercentAll)}
            </Text>
          </View>
        </View>
        {gapAll > 0 && (
          <View style={activeStyles.gapBanner}>
            <Text style={activeStyles.gapText}>⚠️ Gap: {gapAll} bags remaining to reach {activeTarget}% target</Text>
          </View>
        )}
        <TouchableOpacity style={activeStyles.addPunchBtn} onPress={() => router.push('/sale/add?type=punch' as any)}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={activeStyles.addPunchText}>Add Punch</Text>
        </TouchableOpacity>
      </View>

      {/* Dealer-wise Sales */}
      {(dealerSales?.length ?? 0) > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>DEALER-WISE SALES</Text>
          {(dealerSales || []).map((d, i) => (
            <DealerRow key={d.dealer_id} dealer={d} rank={i + 1} />
          ))}
        </View>
      )}

      {/* Team Active % */}
      {(teActive?.length ?? 0) > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>TEAM ACTIVE %</Text>
          {(teActive || []).map(te => (
            <TEActiveRow key={te.te} te={te} />
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  sectionCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  targetText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  totalMT: { fontSize: 36, fontWeight: '800', color: Colors.primary },
  totalBags: { fontSize: 14, color: Colors.textSecondary, marginTop: 2, marginBottom: 16 },
});

const filterStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
});

const productStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  name: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  mt: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  bags: { fontSize: 12, color: Colors.textSecondary },
});

const activeStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  cell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
  },
  highlightCell: { backgroundColor: Colors.primaryLight },
  cellLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  cellValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  gapBanner: {
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  gapText: { fontSize: 13, color: Colors.warning, fontWeight: '500' },
  addPunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
  },
  addPunchText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
});

const dealerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 8,
  },
  rank: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, width: 28 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  area: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  mt: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  productRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  f2r: { fontSize: 10, color: Colors.textSecondary },
  gold: { fontSize: 10, color: '#D97706' },
  activeBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  activeText: { fontSize: 9, fontWeight: '700' },
});

const metricStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    gap: 12,
  },
  icon: { fontSize: 22 },
  label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  value: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  sub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
});

const teStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  name: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  stat: { fontSize: 11, color: Colors.textSecondary },
  percent: { fontSize: 20, fontWeight: '800', minWidth: 56, textAlign: 'right' },
});
