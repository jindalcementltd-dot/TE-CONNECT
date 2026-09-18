import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiGetMeetings, apiUpdateMeeting } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { formatDate } from '../../src/utils/helpers';
import { Meeting, MeetingStatus } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

const typeColor: Record<string, string> = {
  CUSTOMER: Colors.meetingCustomer,
  CONTRACTOR: Colors.meetingContractor,
  OTHER: Colors.meetingOther,
};
const typeBg: Record<string, string> = {
  CUSTOMER: Colors.meetingCustomerBg,
  CONTRACTOR: Colors.meetingContractorBg,
  OTHER: Colors.meetingOtherBg,
};

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['allMeetings'],
    queryFn: () => apiGetMeetings({}),
  });

  const meeting = meetings?.find(m => m.meeting_id === id);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiUpdateMeeting(id, data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Updated', text2: 'Meeting updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetingTargetSummary'] });
      queryClient.invalidateQueries({ queryKey: ['allMeetings'] });
      setCompleting(false);
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const handleComplete = async () => {
    const user = await getUser();
    updateMutation.mutate({
      status: 'COMPLETED',
      outcome,
      people_count: peopleCount ? Number(peopleCount) : undefined,
      expense_amount: expenseAmount ? Number(expenseAmount) : undefined,
      next_followup: nextFollowup,
      updated_by: user?.name || '',
    });
  };

  const handleCancel = async () => {
    const user = await getUser();
    Alert.alert('Cancel Meeting', 'Mark this meeting as cancelled?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => updateMutation.mutate({ status: 'CANCELLED', updated_by: user?.name || '' }) },
    ]);
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!meeting) return <View style={styles.center}><Text style={{ color: Colors.textSecondary }}>Meeting not found.</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Meeting Details</Text>
        <View style={[styles.typeBadge, { backgroundColor: typeBg[meeting.meeting_type] }]}>
          <Text style={[styles.typeText, { color: typeColor[meeting.meeting_type] }]}>{meeting.meeting_type}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>Meeting Date</Text>
          <Text style={styles.dateValue}>{formatDate(meeting.meeting_date)}</Text>
          <View style={[styles.statusPill, { backgroundColor: meeting.status === 'COMPLETED' ? Colors.successLight : meeting.status === 'CANCELLED' ? Colors.borderLight : Colors.infoLight }]}>
            <Text style={[styles.statusText, { color: meeting.status === 'COMPLETED' ? Colors.success : meeting.status === 'CANCELLED' ? Colors.textMuted : Colors.info }]}>{meeting.status}</Text>
          </View>
        </View>

        <View style={styles.card}>
          {meeting.meeting_name ? <DetailRow icon="👤" label="Name" value={meeting.meeting_name} /> : null}
          <DetailRow icon="👷" label="TE" value={meeting.te || '—'} />
          {meeting.location ? <DetailRow icon="📍" label="Location" value={meeting.location} /> : null}
          {meeting.purpose ? <DetailRow icon="🎯" label="Purpose" value={meeting.purpose} /> : null}
          {meeting.people_count ? <DetailRow icon="👥" label="People" value={String(meeting.people_count)} /> : null}
          {meeting.outcome ? <DetailRow icon="📋" label="Outcome" value={meeting.outcome} /> : null}
          {meeting.next_followup ? <DetailRow icon="📅" label="Next Follow-up" value={formatDate(meeting.next_followup)} /> : null}
          {meeting.expense_amount ? <DetailRow icon="💰" label="Expense" value={`₹${meeting.expense_amount}`} /> : null}
          <DetailRow icon="📡" label="Source" value={meeting.source} />
          <DetailRow icon="🕐" label="Added" value={formatDate(meeting.created_at)} />
        </View>

        {meeting.status === 'PLANNED' && !completing && (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Actions</Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.successLight }]}
              onPress={() => setCompleting(true)}
            >
              <Text style={[styles.actionBtnText, { color: Colors.success }]}>✅ Mark as Completed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.borderLight }]}
              onPress={handleCancel}
            >
              <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>❌ Cancel Meeting</Text>
            </TouchableOpacity>
          </View>
        )}

        {completing && (
          <View style={styles.completeCard}>
            <Text style={styles.actionsTitle}>Complete Meeting</Text>
            <View style={styles.group}>
              <Text style={styles.label}>Outcome</Text>
              <TextInput style={[styles.input, styles.textarea]} value={outcome} onChangeText={setOutcome} placeholder="What was the outcome?" placeholderTextColor={Colors.textMuted} multiline />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>People Count</Text>
              <TextInput style={styles.input} value={peopleCount} onChangeText={setPeopleCount} placeholder="How many people attended?" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Expense (₹)</Text>
              <TextInput style={styles.input} value={expenseAmount} onChangeText={setExpenseAmount} placeholder="Amount spent" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Next Follow-up Date</Text>
              <TextInput style={styles.input} value={nextFollowup} onChangeText={setNextFollowup} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, updateMutation.isPending && styles.submitBtnDisabled]}
              onPress={handleComplete}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Save Completion ✅</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelComplete} onPress={() => setCompleting(false)}>
              <Text style={{ color: Colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={detailStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  typeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  typeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  scroll: { flex: 1, padding: Spacing.base },
  dateCard: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md },
  dateLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500', letterSpacing: 1 },
  dateValue: { fontSize: 26, fontWeight: '800', color: Colors.white, marginTop: 4 },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  actionsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.md },
  completeCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.md },
  actionsTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  actionBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
  group: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 7 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.white },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.success, borderRadius: BorderRadius.lg, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 10 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  cancelComplete: { alignItems: 'center', padding: 10 },
});

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
  icon: { fontSize: 18, width: 24 },
  label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginBottom: 2 },
  value: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
});
