import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { apiGetMeetings, apiUpdateMeeting } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { normalizeDate } from '../../src/utils/helpers';
import { Meeting, MeetingStatus } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiGetMeetings(),
  });

  const meeting = (meetings || []).find(m => m.meeting_id === id);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiUpdateMeeting(id, data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Meeting Updated ✅', text2: 'Google Sheet updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetingTargetSummary'] });
      queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
      setCompleting(false);
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to update meeting.' }),
  });

  const handleSetStatus = async (status: MeetingStatus) => {
    if (meeting?.status === status) return;
    const user = await getUser();
    updateMutation.mutate({
      status,
      updated_by: user?.name || 'Administrator',
    });
  };

  const handleCompleteWithDetails = async () => {
    const user = await getUser();
    updateMutation.mutate({
      status: 'COMPLETED',
      outcome,
      people_count: peopleCount ? Number(peopleCount) : undefined,
      expense_amount: expenseAmount ? Number(expenseAmount) : undefined,
      next_followup: nextFollowup,
      updated_by: user?.name || 'Administrator',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#800E20" />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#800E20" />
        <Text style={styles.notFoundTitle}>Meeting Not Found</Text>
        <Text style={styles.notFoundSub}>This meeting record may have been removed.</Text>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>‹ Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const normDate = normalizeDate(meeting.meeting_date);
  let formattedDate = normDate;
  try {
    if (normDate) {
      formattedDate = format(new Date(normDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy');
    }
  } catch {}

  const isCompleted = meeting.status === 'COMPLETED';
  const isCancelled = meeting.status === 'CANCELLED';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#1F0B10" />
        </TouchableOpacity>
        <Text style={styles.title}>Meeting Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── 1. PROTON HERO CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroSubtitle}>{meeting.meeting_type} MEETING</Text>
              <Text style={styles.heroTitle}>{meeting.meeting_name || 'Field Meeting'}</Text>
            </View>
            <View style={[
              styles.heroStatusBadge,
              isCompleted ? styles.heroStatusComp : isCancelled ? styles.heroStatusCanc : styles.heroStatusUpc
            ]}>
              <Text style={[
                styles.heroStatusBadgeText,
                isCompleted ? { color: '#15803D' } : isCancelled ? { color: '#6B7280' } : { color: '#800E20' }
              ]}>
                {meeting.status}
              </Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroDateRow}>
            <Ionicons name="calendar" size={18} color="#E53935" style={{ marginRight: 8 }} />
            <Text style={styles.heroDateText}>{formattedDate}</Text>
          </View>
        </View>

        {/* ── 2. INSTANT STATUS CHANGER ── */}
        <View style={styles.statusSectionCard}>
          <Text style={styles.sectionHeading}>Meeting Status</Text>
          <Text style={styles.sectionSubHeading}>Tap to update status directly in Google Sheet:</Text>

          <View style={styles.statusButtonsRow}>
            {/* Planned */}
            <TouchableOpacity
              style={[
                styles.statusSelectBtn,
                meeting.status === 'PLANNED' && styles.statusSelectBtnUpcomingActive
              ]}
              onPress={() => handleSetStatus('PLANNED')}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color={meeting.status === 'PLANNED' ? '#FFFFFF' : '#800E20'}
              />
              <Text style={[
                styles.statusSelectBtnText,
                meeting.status === 'PLANNED' && styles.statusSelectBtnTextActive
              ]}>
                Planned
              </Text>
            </TouchableOpacity>

            {/* Completed */}
            <TouchableOpacity
              style={[
                styles.statusSelectBtn,
                isCompleted && styles.statusSelectBtnCompletedActive
              ]}
              onPress={() => {
                if (!isCompleted) setCompleting(true);
              }}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={18}
                color={isCompleted ? '#FFFFFF' : '#15803D'}
              />
              <Text style={[
                styles.statusSelectBtnText,
                { color: isCompleted ? '#FFFFFF' : '#15803D' }
              ]}>
                Completed
              </Text>
            </TouchableOpacity>

            {/* Cancelled */}
            <TouchableOpacity
              style={[
                styles.statusSelectBtn,
                isCancelled && styles.statusSelectBtnCancelledActive
              ]}
              onPress={() => handleSetStatus('CANCELLED')}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="close-circle-outline"
                size={18}
                color={isCancelled ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[
                styles.statusSelectBtnText,
                { color: isCancelled ? '#FFFFFF' : '#6B7280' }
              ]}>
                Cancelled
              </Text>
            </TouchableOpacity>
          </View>

          {updateMutation.isPending && (
            <View style={styles.updatingRow}>
              <ActivityIndicator size="small" color="#800E20" />
              <Text style={styles.updatingText}>Syncing with Google Sheet...</Text>
            </View>
          )}
        </View>

        {/* ── COMPLETE MODAL CARD (IF EDITING OUTCOME) ── */}
        {completing && (
          <View style={styles.completeFormCard}>
            <Text style={styles.completeFormTitle}>Log Meeting Completion Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Meeting Outcome / Decisions</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={outcome}
                onChangeText={setOutcome}
                placeholder="Key takeaways, agreements, bags promised..."
                placeholderTextColor="#A0858C"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>People Attended</Text>
              <TextInput
                style={styles.input}
                value={peopleCount}
                onChangeText={setPeopleCount}
                placeholder="Number of participants"
                placeholderTextColor="#A0858C"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expense (₹)</Text>
              <TextInput
                style={styles.input}
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                placeholder="e.g. 350"
                placeholderTextColor="#A0858C"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Next Follow-up Date</Text>
              <TextInput
                style={styles.input}
                value={nextFollowup}
                onChangeText={setNextFollowup}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0858C"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitCompleteBtn, updateMutation.isPending && { opacity: 0.7 }]}
              onPress={handleCompleteWithDetails}
              disabled={updateMutation.isPending}
              activeOpacity={0.85}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitCompleteBtnText}>Save Completion to Google Sheet ✅</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelCompleteBtn}
              onPress={() => setCompleting(false)}
            >
              <Text style={styles.cancelCompleteBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 3. FULL DETAILS CARD ── */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsCardHeader}>Meeting Information</Text>

          <DetailRow icon="account-tie" label="Contact Name / Entity" value={meeting.meeting_name || meeting.meeting_type} highlight />
          <DetailRow icon="badge-account-horizontal" label="Assigned TE" value={meeting.te || 'Team Jajpur'} />
          {meeting.location ? <DetailRow icon="map-marker-radius" label="Location / Venue" value={meeting.location} /> : null}
          {meeting.purpose ? <DetailRow icon="target" label="Purpose" value={meeting.purpose} /> : null}
          {meeting.people_count ? <DetailRow icon="account-group" label="Attendees" value={`${meeting.people_count} People`} /> : null}
          {meeting.outcome ? <DetailRow icon="clipboard-check" label="Outcome" value={meeting.outcome} /> : null}
          {meeting.next_followup ? <DetailRow icon="calendar-clock" label="Next Follow-up" value={normalizeDate(meeting.next_followup)} /> : null}
          {meeting.expense_amount ? <DetailRow icon="cash-multiple" label="Expenses" value={`₹${meeting.expense_amount}`} /> : null}

          {meeting.remark ? (
            <View style={styles.remarkContainer}>
              <Text style={styles.remarkLabel}>Notes / Remarks:</Text>
              <Text style={styles.remarkValue}>{meeting.remark}</Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Source: {meeting.source || 'APP'}</Text>
            <Text style={styles.metaText}>Created by: {meeting.created_by || 'Admin'}</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconBox}>
        <MaterialCommunityIcons name={icon} size={20} color="#800E20" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={[detailStyles.value, highlight && detailStyles.highlightValue]}>{value}</Text>
      </View>
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
    padding: 24,
    backgroundColor: '#F9F5F6',
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
    marginTop: 12,
  },
  notFoundSub: {
    fontSize: 13,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
  },
  backButtonSimple: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#800E20',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  scroll: {
    flex: 1,
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
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  heroStatusUpc: {
    backgroundColor: '#FBE8EC',
    borderColor: '#E8D5DA',
  },
  heroStatusComp: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  heroStatusCanc: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  heroStatusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 14,
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroDateText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // 2. Status Changer
  statusSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 16,
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  sectionSubHeading: {
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
    marginBottom: 12,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FAF6F7',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    gap: 6,
  },
  statusSelectBtnUpcomingActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  statusSelectBtnCompletedActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  statusSelectBtnCancelledActive: {
    backgroundColor: '#4B5563',
    borderColor: '#4B5563',
  },
  statusSelectBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#800E20',
  },
  statusSelectBtnTextActive: {
    color: '#FFFFFF',
  },
  updatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  updatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#800E20',
  },

  // Complete Form Card
  completeFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#800E20',
    marginBottom: 16,
    shadowColor: 'rgba(78, 5, 17, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  completeFormTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#800E20',
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F0B10',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F0B10',
    backgroundColor: '#FAF6F7',
    fontWeight: '600',
  },
  textarea: {
    height: 70,
    textAlignVertical: 'top',
  },
  submitCompleteBtn: {
    backgroundColor: '#15803D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitCompleteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelCompleteBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  cancelCompleteBtnText: {
    color: '#8A7277',
    fontSize: 13,
    fontWeight: '600',
  },

  // 3. Details Card
  detailsCard: {
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
  detailsCardHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 12,
  },
  remarkContainer: {
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0D5DA',
    marginTop: 8,
    marginBottom: 12,
  },
  remarkLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#800E20',
    marginBottom: 4,
  },
  remarkValue: {
    fontSize: 13,
    color: '#1F0B10',
    lineHeight: 18,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F7EFF1',
  },
  metaText: {
    fontSize: 11,
    color: '#A0858C',
  },
});

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: '#8A7277',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#1F0B10',
    fontWeight: '700',
    marginTop: 2,
  },
  highlightValue: {
    color: '#800E20',
    fontWeight: '900',
    fontSize: 15,
  },
});

