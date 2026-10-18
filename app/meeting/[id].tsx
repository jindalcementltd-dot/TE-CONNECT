import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { apiGetMeetings, apiUpdateMeeting, apiGetUsers } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { normalizeDate } from '../../src/utils/helpers';
import { Meeting, MeetingStatus, User } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [completing, setCompleting] = useState(false);
  const [creditedTE, setCreditedTE] = useState<string>('');
  const [outcome, setOutcome] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');

  const { data: meetings, isLoading } = useQuery({ queryKey: ['meetings'], queryFn: () => apiGetMeetings() });
  const { data: usersList } = useQuery({ queryKey: ['users'], queryFn: () => apiGetUsers() });

  const meeting = (meetings || []).find(m => m.meeting_id === id);

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
    });
  }, []);

  useEffect(() => {
    if (meeting?.te && !creditedTE) {
      setCreditedTE(meeting.te);
    } else if (user?.name && !creditedTE) {
      setCreditedTE(user.name);
    }
  }, [meeting?.te, user?.name]);

  const teList = useMemo(() => {
    const set = new Set<string>();
    if (user?.name && user.name.trim()) set.add(user.name.trim());
    if (meeting?.te && meeting.te.trim()) set.add(meeting.te.trim());
    (usersList || []).forEach(u => {
      if (u.name && u.name.trim()) set.add(u.name.trim());
    });
    return Array.from(set);
  }, [usersList, user, meeting?.te]);

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
    const currentUser = await getUser();
    updateMutation.mutate({ status, updated_by: currentUser?.name || 'Administrator' });
  };

  const handleCompleteWithDetails = async () => {
    const currentUser = await getUser();
    const finalTE = creditedTE || meeting?.te || currentUser?.name || 'Administrator';
    updateMutation.mutate({
      status: 'COMPLETED',
      te: finalTE,
      outcome,
      people_count: peopleCount ? Number(peopleCount) : undefined,
      expense_amount: expenseAmount ? Number(expenseAmount) : undefined,
      next_followup: nextFollowup,
      updated_by: currentUser?.name || 'Administrator',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Colors.primary} />
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
  try { if (normDate) formattedDate = format(new Date(normDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy'); } catch {}

  const isCompleted = meeting.status === 'COMPLETED';
  const isCancelled = meeting.status === 'CANCELLED';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Meeting Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroSubtitle}>{meeting.meeting_type} MEETING</Text>
              <Text style={styles.heroTitle}>{meeting.meeting_name || 'Field Meeting'}</Text>
            </View>
            <View style={[styles.heroStatusBadge, isCompleted ? styles.heroStatusComp : isCancelled ? styles.heroStatusCanc : styles.heroStatusUpc]}>
              <Text style={[styles.heroStatusBadgeText, isCompleted ? { color: Colors.success } : isCancelled ? { color: Colors.statusCancelled } : { color: Colors.primary }]}>{meeting.status}</Text>
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroDateRow}>
            <Ionicons name="calendar" size={18} color={Colors.primaryLight} style={{ marginRight: 8 }} />
            <Text style={styles.heroDateText}>{formattedDate}</Text>
          </View>
        </View>

        <View style={styles.statusSectionCard}>
          <Text style={styles.sectionHeading}>Meeting Status</Text>
          <Text style={styles.sectionSubHeading}>Tap to update status directly in Google Sheet:</Text>

          <View style={styles.statusButtonsRow}>
            <TouchableOpacity style={[styles.statusSelectBtn, meeting.status === 'PLANNED' && styles.statusSelectBtnUpcomingActive]} onPress={() => handleSetStatus('PLANNED')} disabled={updateMutation.isPending} activeOpacity={0.8}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={meeting.status === 'PLANNED' ? Colors.white : Colors.primary} />
              <Text style={[styles.statusSelectBtnText, meeting.status === 'PLANNED' && styles.statusSelectBtnTextActive]}>Planned</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statusSelectBtn, isCompleted && styles.statusSelectBtnCompletedActive]} 
              onPress={() => { 
                if (!isCompleted) {
                  if (meeting.te) setCreditedTE(meeting.te);
                  else if (user?.name) setCreditedTE(user.name);
                  if (meeting.people_count) setPeopleCount(String(meeting.people_count));
                  if (meeting.outcome) setOutcome(meeting.outcome);
                  setCompleting(true);
                }
              }} 
              disabled={updateMutation.isPending} 
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="check-circle" size={18} color={isCompleted ? Colors.white : Colors.success} />
              <Text style={[styles.statusSelectBtnText, { color: isCompleted ? Colors.white : Colors.success }]}>Completed</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusSelectBtn, isCancelled && styles.statusSelectBtnCancelledActive]} onPress={() => handleSetStatus('CANCELLED')} disabled={updateMutation.isPending} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close-circle-outline" size={18} color={isCancelled ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.statusSelectBtnText, { color: isCancelled ? Colors.white : Colors.textSecondary }]}>Cancelled</Text>
            </TouchableOpacity>
          </View>

          {updateMutation.isPending && (
            <View style={styles.updatingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.updatingText}>Syncing with Google Sheet...</Text>
            </View>
          )}
        </View>

        {completing && (
          <View style={styles.completeFormCard}>
            <Text style={styles.completeFormTitle}>Log Meeting Completion Details</Text>

            {/* Kisne Attend Kiya / Target Credit To TE */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Kisne Attend Kiya? (Target Credit To TE) <Text style={{ color: Colors.primary }}>*</Text>
              </Text>
              <Text style={styles.inputSubtext}>
                Is meeting ka attendees count is TE ke monthly target me judega (Target: 100 Contractor / 50 IHB):
              </Text>
              <View style={styles.teChipsContainer}>
                {teList.map((teName) => {
                  const isSelected = (creditedTE || meeting.te || user?.name) === teName;
                  const isMe = teName === user?.name;
                  return (
                    <TouchableOpacity
                      key={teName}
                      style={[styles.teAttendChip, isSelected && styles.teAttendChipActive]}
                      onPress={() => setCreditedTE(teName)}
                      activeOpacity={0.8}
                    >
                      <Feather
                        name="user"
                        size={13}
                        color={isSelected ? '#FFFFFF' : Colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.teAttendChipText, isSelected && styles.teAttendChipTextActive]}>
                        {teName} {isMe ? '(Me)' : ''}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>People Attended *</Text>
              <TextInput 
                style={styles.input} 
                value={peopleCount} 
                onChangeText={setPeopleCount} 
                placeholder="Number of participants (e.g. 25)" 
                placeholderTextColor={Colors.textMuted} 
                keyboardType="numeric" 
              />
              <View style={styles.quickCountRow}>
                {[10, 25, 50, 100].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.quickCountBtn}
                    onPress={() => setPeopleCount(String(num))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickCountBtnText}>+{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Meeting Outcome / Decisions</Text>
              <TextInput style={[styles.input, styles.textarea]} value={outcome} onChangeText={setOutcome} placeholder="Key takeaways, agreements, bags promised..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expense (₹)</Text>
              <TextInput style={styles.input} value={expenseAmount} onChangeText={setExpenseAmount} placeholder="e.g. 350" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Next Follow-up Date</Text>
              <TextInput style={styles.input} value={nextFollowup} onChangeText={setNextFollowup} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
            </View>

            <TouchableOpacity style={[styles.submitCompleteBtn, updateMutation.isPending && { opacity: 0.7 }]} onPress={handleCompleteWithDetails} disabled={updateMutation.isPending} activeOpacity={0.85}>
              {updateMutation.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitCompleteBtnText}>Save Completion & Credit Target ✅</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelCompleteBtn} onPress={() => setCompleting(false)}>
              <Text style={styles.cancelCompleteBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

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
        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconBox}><MaterialCommunityIcons name={icon} size={20} color={Colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={[detailStyles.value, highlight && detailStyles.highlightValue]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: Colors.background },
  notFoundTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary, marginTop: Spacing.md },
  notFoundSub: { fontFamily: FontFamily.sansRegular, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },
  backButtonSimple: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg },
  backButtonText: { fontFamily: FontFamily.sansBold, color: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 60 : Spacing['2xl'], paddingBottom: Spacing.base, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40 },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.lg },

  heroCard: { backgroundColor: Colors.primaryDark, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, marginBottom: Spacing.lg, shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroSubtitle: { fontFamily: FontFamily.sansBold, fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  heroTitle: { fontFamily: FontFamily.displayBlack, fontSize: FontSize['2xl'], color: Colors.white, marginTop: 4 },
  heroStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1 },
  heroStatusUpc: { backgroundColor: Colors.primaryLight, borderColor: Colors.borderLight },
  heroStatusComp: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  heroStatusCanc: { backgroundColor: Colors.statusCancelledBg, borderColor: Colors.border },
  heroStatusBadgeText: { fontFamily: FontFamily.sansBold, fontSize: 11, letterSpacing: 0.5 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 14 },
  heroDateRow: { flexDirection: 'row', alignItems: 'center' },
  heroDateText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.white },

  statusSectionCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  sectionHeading: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.textPrimary },
  sectionSubHeading: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.md },
  statusButtonsRow: { flexDirection: 'row', gap: Spacing.sm },
  statusSelectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: BorderRadius.lg, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  statusSelectBtnUpcomingActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusSelectBtnCompletedActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  statusSelectBtnCancelledActive: { backgroundColor: Colors.statusCancelled, borderColor: Colors.statusCancelled },
  statusSelectBtnText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.xs, color: Colors.primary },
  statusSelectBtnTextActive: { color: Colors.white },
  updatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md, gap: Spacing.sm },
  updatingText: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.xs, color: Colors.primary },

  completeFormCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primary, marginBottom: Spacing.lg, shadowColor: 'rgba(78, 5, 17, 0.1)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 4 },
  completeFormTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.primary, marginBottom: Spacing.md },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: { fontFamily: FontFamily.sansBold, fontSize: FontSize.xs, color: Colors.textPrimary, marginBottom: 4 },
  inputSubtext: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textSecondary, marginBottom: 8 },
  input: { fontFamily: FontFamily.sansMedium, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.sm, color: Colors.textPrimary, backgroundColor: Colors.background },
  textarea: { height: 70, textAlignVertical: 'top' },
  teChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teAttendChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB' },
  teAttendChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  teAttendChipText: { fontFamily: FontFamily.sansBold, fontSize: 12, color: '#374151', },
  teAttendChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  quickCountRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  quickCountBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.borderLight },
  quickCountBtnText: { fontFamily: FontFamily.sansBold, fontSize: 12, color: Colors.primary, },
  submitCompleteBtn: { backgroundColor: Colors.success, borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
  submitCompleteBtnText: { fontFamily: FontFamily.sansBold, color: Colors.white, fontSize: FontSize.sm },
  cancelCompleteBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelCompleteBtnText: { fontFamily: FontFamily.sansSemiBold, color: Colors.textSecondary, fontSize: FontSize.sm },

  detailsCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  detailsCardHeader: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.textPrimary, marginBottom: Spacing.md },
  remarkContainer: { backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight, marginTop: Spacing.sm, marginBottom: Spacing.md },
  remarkLabel: { fontFamily: FontFamily.sansBold, fontSize: 11, color: Colors.primary, marginBottom: 4 },
  remarkValue: { fontFamily: FontFamily.sansRegular, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  metaText: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textMuted },
});

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.sansSemiBold, fontSize: 11, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 2 },
  highlightValue: { fontFamily: FontFamily.sansBold, color: Colors.primary, fontSize: FontSize.base },
});
