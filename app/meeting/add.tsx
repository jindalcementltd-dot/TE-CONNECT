import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiCreateMeeting } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO } from '../../src/utils/helpers';
import { User, MeetingType, AddMeetingForm } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

export default function AddMeetingScreen() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  const [meetingDate, setMeetingDate] = useState(currentDateISO());
  const [meetingType, setMeetingType] = useState<MeetingType>('CUSTOMER');
  const [meetingName, setMeetingName] = useState('');
  const [location, setLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [remark, setRemark] = useState('');

  useEffect(() => { getUser().then(setUser); }, []);

  const mutation = useMutation({
    mutationFn: (data: any) => apiCreateMeeting(data),
    onSuccess: (res) => {
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Meeting Added', text2: 'Meeting planned successfully.' });
        queryClient.invalidateQueries({ queryKey: ['meetings'] });
        queryClient.invalidateQueries({ queryKey: ['meetingTargetSummary'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const handleSubmit = () => {
    if (!meetingDate) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Meeting date is required.' }); return; }
    if (!meetingType) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Meeting type is required.' }); return; }
    mutation.mutate({
      meeting_date: meetingDate,
      meeting_type: meetingType,
      meeting_name: meetingName,
      location,
      purpose,
      people_count: peopleCount ? Number(peopleCount) : undefined,
      outcome,
      next_followup: nextFollowup,
      expense_amount: expenseAmount ? Number(expenseAmount) : undefined,
      remark,
      te: user?.name || '',
      created_by: user?.name || '',
      status: 'PLANNED',
      source: 'APP',
    });
  };

  const typeConfig: Record<MeetingType, { label: string; color: string; bg: string; emoji: string }> = {
    CUSTOMER: { label: 'Customer', color: Colors.meetingCustomer, bg: Colors.meetingCustomerBg, emoji: '🏪' },
    CONTRACTOR: { label: 'Contractor', color: Colors.meetingContractor, bg: Colors.meetingContractorBg, emoji: '👷' },
    OTHER: { label: 'Other', color: Colors.meetingOther, bg: Colors.meetingOtherBg, emoji: '🤝' },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Meeting</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Meeting Type */}
        <View style={styles.group}>
          <Text style={styles.label}>Meeting Type <Text style={styles.required}>*</Text></Text>
          <View style={typeStyles.row}>
            {(Object.entries(typeConfig) as [MeetingType, any][]).map(([type, cfg]) => (
              <TouchableOpacity
                key={type}
                style={[typeStyles.btn, meetingType === type && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                onPress={() => setMeetingType(type)}
              >
                <Text style={typeStyles.emoji}>{cfg.emoji}</Text>
                <Text style={[typeStyles.btnText, meetingType === type && { color: cfg.color }]}>{cfg.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Meeting Date */}
        <View style={styles.group}>
          <Text style={styles.label}>Meeting Date <Text style={styles.required}>*</Text></Text>
          <TextInput style={styles.input} value={meetingDate} onChangeText={setMeetingDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
        </View>

        {/* Name */}
        <View style={styles.group}>
          <Text style={styles.label}>Contact Name</Text>
          <TextInput style={styles.input} value={meetingName} onChangeText={setMeetingName} placeholder="Customer / contractor name" placeholderTextColor={Colors.textMuted} />
        </View>

        {/* Location */}
        <View style={styles.group}>
          <Text style={styles.label}>Location <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Meeting location" placeholderTextColor={Colors.textMuted} />
        </View>

        {/* Purpose */}
        <View style={styles.group}>
          <Text style={styles.label}>Purpose <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={styles.input} value={purpose} onChangeText={setPurpose} placeholder="Purpose of meeting" placeholderTextColor={Colors.textMuted} />
        </View>

        {/* People Count */}
        <View style={styles.group}>
          <Text style={styles.label}>People Count <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={styles.input} value={peopleCount} onChangeText={setPeopleCount} placeholder="Number of people" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
        </View>

        {/* Outcome */}
        <View style={styles.group}>
          <Text style={styles.label}>Outcome <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={[styles.input, styles.textarea]} value={outcome} onChangeText={setOutcome} placeholder="Meeting outcome or result" placeholderTextColor={Colors.textMuted} multiline />
        </View>

        {/* Next Follow-up */}
        <View style={styles.group}>
          <Text style={styles.label}>Next Follow-up Date <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={styles.input} value={nextFollowup} onChangeText={setNextFollowup} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
        </View>

        {/* Expense */}
        <View style={styles.group}>
          <Text style={styles.label}>Expense Amount (₹) <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={styles.input} value={expenseAmount} onChangeText={setExpenseAmount} placeholder="Amount in rupees" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
        </View>

        {/* Remark */}
        <View style={styles.group}>
          <Text style={styles.label}>Remark <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={[styles.input, styles.textarea]} value={remark} onChangeText={setRemark} placeholder="Any additional notes" placeholderTextColor={Colors.textMuted} multiline />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Add Meeting 🤝</Text>
          }
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.base },
  group: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 7 },
  required: { color: Colors.error },
  optional: { color: Colors.textMuted, fontWeight: '400', fontSize: 11 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.white },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: 16, alignItems: 'center', marginTop: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
});

const typeStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  emoji: { fontSize: 22, marginBottom: 4 },
  btnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
});