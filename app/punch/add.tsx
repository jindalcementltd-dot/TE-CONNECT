import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import {
  apiGetUsers, apiGetContractors, apiGetActiveTracker, apiAddPunch,
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO, currentMonthISO, normalizeDate } from '../../src/utils/helpers';
import { User, ActiveTracker } from '../../src/types';
import { addNotification } from '../../src/services/notifications';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function AddPunchScreen() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Form State
  const [punchDate, setPunchDate] = useState<string>(currentDateISO());
  const [selectedTE, setSelectedTE] = useState<string>('');
  const [showTePicker, setShowTePicker] = useState<boolean>(false);

  // Product Bags Inputs
  const [f2rBags, setF2rBags] = useState<string>('');
  const [goldBags, setGoldBags] = useState<string>('');

  // Contractor Counts
  const [totalContractorsInput, setTotalContractorsInput] = useState<string>('');
  const [newlyActiveInput, setNewlyActiveInput] = useState<string>('');
  const [directActiveInput, setDirectActiveInput] = useState<string>('');
  const [isDirectActiveMode, setIsDirectActiveMode] = useState<boolean>(false);

  const [punchRemark, setPunchRemark] = useState<string>('');

  useEffect(() => {
    getUser().then(u => {
      setCurrentUser(u);
      if (u && !selectedTE) {
        setSelectedTE(u.name);
      }
    });
  }, []);

  const { data: usersList } = useQuery({ queryKey: ['users'], queryFn: () => apiGetUsers() });
  const { data: contractors } = useQuery({ queryKey: ['contractors'], queryFn: () => apiGetContractors() });
  const { data: activeTrackers } = useQuery({ queryKey: ['activeTrackers'], queryFn: () => apiGetActiveTracker() });

  // List of all unique TEs for dropdown
  const teList = useMemo(() => {
    const set = new Set<string>();
    if (currentUser?.name && currentUser.name.trim()) set.add(currentUser.name.trim());
    (usersList || []).forEach(u => {
      if (u.name && u.name.trim()) set.add(u.name.trim());
    });
    (contractors || []).forEach(c => {
      if (c.assigned_te && c.assigned_te.trim()) set.add(c.assigned_te.trim());
    });
    (activeTrackers || []).forEach(t => {
      if (t.te && t.te.trim()) set.add(t.te.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [currentUser, usersList, contractors, activeTrackers]);

  const effectiveTE = selectedTE || currentUser?.name || (teList[0] || 'TE');

  // Month for this punch date
  const punchMonth = punchDate ? punchDate.substring(0, 7) : currentMonthISO();

  // Selected TE's current tracker in Google Sheets for this month
  const currentTETracker = useMemo(() => {
    const list = activeTrackers || [];
    const effLower = effectiveTE.toLowerCase().trim();
    return list.find(t =>
      normalizeDate(t.month || t.date).startsWith(punchMonth) &&
      String(t.te || '').toLowerCase().trim() === effLower
    );
  }, [activeTrackers, effectiveTE, punchMonth]);

  const currentAssignedContractors = useMemo(() => {
    const effLower = effectiveTE.toLowerCase().trim();
    return (contractors || []).filter(c => String(c.assigned_te || '').toLowerCase().trim() === effLower);
  }, [contractors, effectiveTE]);

  // Baseline values for the selected TE
  const baselineTotalContractors = (currentTETracker && Number(currentTETracker.total_contractors) > 0)
    ? Number(currentTETracker.total_contractors)
    : (currentAssignedContractors.length > 0 ? currentAssignedContractors.length : 100);

  const baselineActiveContractors = (currentTETracker && Number(currentTETracker.active_contractors) > 0)
    ? Number(currentTETracker.active_contractors)
    : 0;

  const baselinePunchedBags = currentTETracker ? Number(currentTETracker.punched_quantity_bags) || 0 : 0;

  // Sync inputs when TE or baseline changes
  useEffect(() => {
    if (!totalContractorsInput || totalContractorsInput === '0') {
      setTotalContractorsInput(String(baselineTotalContractors));
    }
    if (!isDirectActiveMode && !directActiveInput) {
      setDirectActiveInput(String(baselineActiveContractors));
    }
  }, [effectiveTE, baselineTotalContractors, baselineActiveContractors]);

  // Total Bags calculation
  const numF2R = Number(f2rBags) || 0;
  const numGold = Number(goldBags) || 0;
  const totalBagsToAdd = numF2R + numGold;
  const totalMTToAdd = (totalBagsToAdd / 20).toFixed(2);

  // Contractor calculations
  const totalContractors = Number(totalContractorsInput) || baselineTotalContractors;
  const newlyActive = Number(newlyActiveInput) || 0;
  const finalActiveContractors = isDirectActiveMode
    ? (Number(directActiveInput) || baselineActiveContractors)
    : Math.min(totalContractors, baselineActiveContractors + newlyActive);

  const activePercent = totalContractors > 0
    ? Math.round((finalActiveContractors / totalContractors) * 100)
    : 0;

  const punchMutation = useMutation({
    mutationFn: (data: any) => apiAddPunch(data),
    onSuccess: (res) => {
      if (res && res.success) {
        Toast.show({
          type: 'success',
          text1: 'Punch Saved Successfully! ✅',
          text2: `${totalBagsToAdd} bags punched for ${effectiveTE}`,
          position: 'top',
        });
        queryClient.invalidateQueries({ queryKey: ['activeTrackers'] });
        queryClient.invalidateQueries({ queryKey: ['teActiveSummary'] });
        queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
        addNotification(
          `🔨 Punch Recorded (${effectiveTE})`,
          `${totalBagsToAdd} bags punched · Active Contractors: ${finalActiveContractors}/${totalContractors}`,
          'PUNCH'
        );
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res?.message || 'Failed to record punch.' });
      }
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Submission Error', text2: err.message || 'Could not save punch.' });
    },
  });

  const handleSubmit = () => {
    if (!punchDate) {
      Toast.show({ type: 'error', text1: 'Missing Date', text2: 'Please specify punch date.' });
      return;
    }
    if (!effectiveTE) {
      Toast.show({ type: 'error', text1: 'Missing TE', text2: 'Please select a TE.' });
      return;
    }
    if (totalBagsToAdd <= 0 && newlyActive <= 0 && !isDirectActiveMode) {
      Toast.show({
        type: 'error',
        text1: 'Missing Quantity',
        text2: 'Please enter bags for ACC F2R or ACC Gold, or update active contractors.',
      });
      return;
    }

    punchMutation.mutate({
      date: punchDate,
      te: effectiveTE,
      punch_quantity_bags: totalBagsToAdd,
      f2r_bags: numF2R,
      gold_bags: numGold,
      total_contractors: totalContractors,
      active_contractors: finalActiveContractors,
      remark: punchRemark,
      updated_by: currentUser?.name || 'Administrator',
    });
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Contractor Punch</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1. TE SELECTOR CARD ("jo cahe kisi ka bhi add kara sakta he") ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>1. Select Target TE</Text>
          <Text style={styles.cardSub}>
            Aap kisi bhi TE ka punch record kar sakte hain. Selected TE ke account me data update hoga:
          </Text>

          <TouchableOpacity
            style={styles.teSelectorBtn}
            onPress={() => setShowTePicker(true)}
            activeOpacity={0.85}
          >
            <View style={styles.teSelectorLeft}>
              <View style={styles.teAvatar}>
                <Feather name="user" size={18} color="#800E20" />
              </View>
              <View>
                <Text style={styles.teSelectedName}>
                  {effectiveTE} {effectiveTE === currentUser?.name ? '(My Account)' : ''}
                </Text>
                <Text style={styles.teSelectedSub}>Tap to change TE</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={20} color="#800E20" />
          </TouchableOpacity>

          {/* Current Status of Selected TE */}
          <View style={styles.currentStatusBox}>
            <View style={styles.currentStatusTop}>
              <Text style={styles.currentStatusTitle}>Current Status for {punchMonth}:</Text>
              <View style={styles.currentActiveBadge}>
                <Text style={styles.currentActiveBadgeText}>
                  {baselineTotalContractors > 0 ? Math.round((baselineActiveContractors / baselineTotalContractors) * 100) : 0}% Active
                </Text>
              </View>
            </View>
            <View style={styles.currentStatsRow}>
              <View style={styles.currentStatItem}>
                <Text style={styles.currentStatVal}>{baselinePunchedBags.toLocaleString()}</Text>
                <Text style={styles.currentStatLbl}>Punched Bags</Text>
              </View>
              <View style={styles.currentStatDivider} />
              <View style={styles.currentStatItem}>
                <Text style={styles.currentStatVal}>{baselineActiveContractors}</Text>
                <Text style={styles.currentStatLbl}>Active Contractors</Text>
              </View>
              <View style={styles.currentStatDivider} />
              <View style={styles.currentStatItem}>
                <Text style={styles.currentStatVal}>{baselineTotalContractors}</Text>
                <Text style={styles.currentStatLbl}>Total Contractors</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 2. DATE ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>2. Punch Date</Text>
          <TextInput
            style={styles.input}
            value={punchDate}
            onChangeText={setPunchDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* ── 3. PRODUCT BAGS (ACC F2R & ACC GOLD) ── */}
        <View style={styles.card}>
          <View style={styles.headingRow}>
            <Text style={styles.cardHeading}>3. Enter Punched Bags</Text>
            {totalBagsToAdd > 0 && (
              <View style={styles.totalBagsPill}>
                <Text style={styles.totalBagsPillText}>Total: {totalBagsToAdd} Bags ({totalMTToAdd} MT)</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSub}>
            ACC F2R aur ACC GOLD me kitna-kitna bag punch hua hai enter karein:
          </Text>

          {/* ACC F2R Input */}
          <View style={styles.productInputBlock}>
            <View style={styles.productInputHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.productDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.productLabel}>ACC F2R (Bags)</Text>
              </View>
              <Text style={styles.productSubRate}>Premium F2R Bags</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. 100"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={f2rBags}
              onChangeText={setF2rBags}
            />
            {/* Quick Count Row */}
            <View style={styles.quickAddRow}>
              {[50, 100, 200, 500].map(amt => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickAddPill}
                  onPress={() => setF2rBags(String((Number(f2rBags) || 0) + amt))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickAddPillText}>+{amt}</Text>
                </TouchableOpacity>
              ))}
              {f2rBags ? (
                <TouchableOpacity
                  style={[styles.quickAddPill, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
                  onPress={() => setF2rBags('')}
                >
                  <Text style={[styles.quickAddPillText, { color: '#DC2626' }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* ACC GOLD Input */}
          <View style={[styles.productInputBlock, { marginTop: 14 }]}>
            <View style={styles.productInputHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.productDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.productLabel}>ACC GOLD (Bags)</Text>
              </View>
              <Text style={styles.productSubRate}>Gold Water Shield Bags</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={goldBags}
              onChangeText={setGoldBags}
            />
            {/* Quick Count Row */}
            <View style={styles.quickAddRow}>
              {[50, 100, 200, 500].map(amt => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickAddPill}
                  onPress={() => setGoldBags(String((Number(goldBags) || 0) + amt))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickAddPillText}>+{amt}</Text>
                </TouchableOpacity>
              ))}
              {goldBags ? (
                <TouchableOpacity
                  style={[styles.quickAddPill, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
                  onPress={() => setGoldBags('')}
                >
                  <Text style={[styles.quickAddPillText, { color: '#DC2626' }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── 4. CONTRACTOR COUNTS & ACTIVE % UPDATE ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>4. Contractor Base & Activation</Text>
          <Text style={styles.cardSub}>
            Total contractor pool aur active contractors ko yahan se live update karein:
          </Text>

          {/* Total Contractors Input */}
          <View style={styles.group}>
            <Text style={styles.label}>Total Contractors for this TE</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 100"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={totalContractorsInput}
              onChangeText={setTotalContractorsInput}
            />
            <Text style={styles.helperText}>
              Is TE ke total registered contractors (e.g. 100). Agar team badhi hai to update karein.
            </Text>
          </View>

          {/* Toggle between "Newly Activated" vs "Direct Total Active" */}
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.toggleModeBtn, !isDirectActiveMode && styles.toggleModeBtnActive]}
              onPress={() => setIsDirectActiveMode(false)}
            >
              <Text style={[styles.toggleModeBtnText, !isDirectActiveMode && styles.toggleModeBtnTextActive]}>
                + Add Newly Active
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleModeBtn, isDirectActiveMode && styles.toggleModeBtnActive]}
              onPress={() => {
                setIsDirectActiveMode(true);
                setDirectActiveInput(String(finalActiveContractors));
              }}
            >
              <Text style={[styles.toggleModeBtnText, isDirectActiveMode && styles.toggleModeBtnTextActive]}>
                Set Total Active Directly
              </Text>
            </TouchableOpacity>
          </View>

          {!isDirectActiveMode ? (
            <View style={styles.group}>
              <Text style={styles.label}>Newly Activated Contractors in this Punch</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 10"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={newlyActiveInput}
                onChangeText={setNewlyActiveInput}
              />
              <View style={styles.quickAddRow}>
                {[5, 10, 15, 20, 25].map(cnt => (
                  <TouchableOpacity
                    key={cnt}
                    style={styles.quickAddPill}
                    onPress={() => setNewlyActiveInput(String(cnt))}
                  >
                    <Text style={styles.quickAddPillText}>+{cnt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.group}>
              <Text style={styles.label}>Total Active Contractors (Month to Date)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 80"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={directActiveInput}
                onChangeText={setDirectActiveInput}
              />
              <Text style={styles.helperText}>
                Month ka kul active contractors count directly set karein.
              </Text>
            </View>
          )}

          {/* Live Outcome Calculation Box */}
          <View style={styles.activeCalculationPreview}>
            <View style={styles.previewTopRow}>
              <Text style={styles.previewTitle}>Resulting Active Status:</Text>
              <View style={[styles.previewBadge, activePercent >= 40 ? styles.previewBadgeSuccess : styles.previewBadgeWarn]}>
                <Text style={[styles.previewBadgeText, activePercent >= 40 ? { color: '#15803D' } : { color: '#B45309' }]}>
                  {activePercent >= 40 ? '✅ Min 40% Met' : `⚠️ Needs ${Math.max(0, Math.ceil(totalContractors * 0.4) - finalActiveContractors)} more`}
                </Text>
              </View>
            </View>

            <View style={styles.previewNumbersRow}>
              <View>
                <Text style={styles.previewActiveFraction}>
                  {finalActiveContractors} <Text style={{ fontSize: 16, color: '#6B7280' }}>/ {totalContractors}</Text>
                </Text>
                <Text style={styles.previewActiveSub}>
                  Previously {baselineActiveContractors} {!isDirectActiveMode && newlyActive > 0 ? `+ ${newlyActive} new` : ''}
                </Text>
              </View>
              <Text style={styles.previewPercentBig}>{activePercent}%</Text>
            </View>
          </View>
        </View>

        {/* ── 5. REMARKS / NOTES ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>5. Remark / Notes (Optional)</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            multiline
            placeholder="Any specific note regarding this punch..."
            placeholderTextColor={Colors.textMuted}
            value={punchRemark}
            onChangeText={setPunchRemark}
          />
        </View>

        {/* ── SUBMIT BUTTON ── */}
        <TouchableOpacity
          style={[styles.submitBtn, punchMutation.isPending && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={punchMutation.isPending}
          activeOpacity={0.85}
        >
          {punchMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Save Punch & Update Active Tracker 🚀</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── TE SELECTION MODAL ── */}
      <Modal
        visible={showTePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTePicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select TE to Credit Punch</Text>
              <TouchableOpacity onPress={() => setShowTePicker(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#1F0B10" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={teList}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = effectiveTE === item;
                const isMe = item === currentUser?.name;
                return (
                  <TouchableOpacity
                    style={[styles.modalOptionRow, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      setSelectedTE(item);
                      setShowTePicker(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={isSelected ? "#800E20" : "#A0858C"}
                      />
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                        {item} {isMe ? '(My Account)' : ''}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color="#800E20" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeading: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 2,
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginBottom: 12,
  },
  group: {
    marginBottom: 12,
  },
  label: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#1F0B10',
    marginBottom: 6,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FAF0F2',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FontFamily.sansMedium,
    color: '#1F0B10',
  },
  helperText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
    marginTop: 4,
  },
  teSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#800E20',
    marginBottom: 12,
  },
  teSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FDE8EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teSelectedName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  teSelectedSub: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#800E20',
  },
  currentStatusBox: {
    backgroundColor: '#FAF0F2',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  currentStatusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  currentStatusTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
    fontWeight: '700',
  },
  currentActiveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentActiveBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#15803D',
    fontWeight: '700',
  },
  currentStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  currentStatVal: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#1F0B10',
  },
  currentStatLbl: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 9,
    color: '#8A7277',
    marginTop: 1,
  },
  currentStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#EEDCE1',
  },
  productInputBlock: {
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  productInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  productDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  productLabel: {
    fontFamily: FontFamily.displayBold,
    fontSize: 13,
    fontWeight: '800',
    color: '#1F0B10',
  },
  productSubRate: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
  },
  quickAddRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickAddPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  quickAddPillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
    fontWeight: '700',
  },
  totalBagsPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  totalBagsPillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleModeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  toggleModeBtnActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  toggleModeBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
    fontWeight: '700',
  },
  toggleModeBtnTextActive: {
    color: '#FFFFFF',
  },
  activeCalculationPreview: {
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F8B4BD',
    marginTop: 4,
  },
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#1F0B10',
    fontWeight: '700',
  },
  previewBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  previewBadgeWarn: {
    backgroundColor: '#FEF3C7',
  },
  previewBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    fontWeight: '700',
  },
  previewNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewActiveFraction: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 22,
    fontWeight: '900',
    color: '#800E20',
  },
  previewActiveSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
    marginTop: 1,
  },
  previewPercentBig: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 28,
    fontWeight: '900',
    color: '#15803D',
  },
  submitBtn: {
    backgroundColor: '#800E20',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 6,
  },
  submitBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
  },
  modalTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
    color: '#1F0B10',
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  modalOptionSelected: {
    backgroundColor: '#FDE8EA',
  },
  modalOptionText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: '#1F0B10',
  },
  modalOptionTextSelected: {
    fontFamily: FontFamily.sansBold,
    color: '#800E20',
    fontWeight: '700',
  },
});
