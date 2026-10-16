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
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { apiCreateMeeting } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO } from '../../src/utils/helpers';
import { User, MeetingType } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

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
        Toast.show({ type: 'success', text1: 'Meeting Scheduled ✅', text2: 'Saved to Google Sheet successfully.' });
        queryClient.invalidateQueries({ queryKey: ['meetings'] });
        queryClient.invalidateQueries({ queryKey: ['meetingTargetSummary'] });
        queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to schedule meeting.' }),
  });

  const handleSubmit = () => {
    if (!meetingDate) { Toast.show({ type: 'error', text1: 'Missing Date', text2: 'Meeting date is required.' }); return; }
    if (!meetingType) { Toast.show({ type: 'error', text1: 'Missing Type', text2: 'Meeting type is required.' }); return; }
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
      te: user?.name || 'Team Jajpur',
      created_by: user?.name || '',
      status: 'PLANNED',
      source: 'APP',
    });
  };

  const typeConfig: Record<MeetingType, { label: string; icon: any; color: string; bg: string }> = {
    CUSTOMER: { label: 'Customer', icon: 'account-tie', color: Colors.primary, bg: Colors.primaryLight },
    CONTRACTOR: { label: 'Contractor', icon: 'account-hard-hat', color: Colors.warning, bg: Colors.warningLight },
    OTHER: { label: 'Other', icon: 'account-group', color: Colors.info, bg: Colors.infoLight },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Schedule Meeting</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <View style={styles.group}>
            <Text style={styles.label}>Meeting Type <Text style={styles.required}>*</Text></Text>
            <View style={styles.typeRow}>
              {(Object.entries(typeConfig) as [MeetingType, any][]).map(([type, cfg]) => {
                const isSelected = meetingType === type;
                return (
                  <TouchableOpacity key={type} style={[styles.typeBtn, isSelected && { backgroundColor: cfg.bg, borderColor: cfg.color }]} onPress={() => setMeetingType(type)} activeOpacity={0.8}>
                    <MaterialCommunityIcons name={cfg.icon} size={22} color={isSelected ? cfg.color : Colors.textSecondary} />
                    <Text style={[styles.typeBtnText, isSelected && { color: cfg.color, fontWeight: '800' }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Meeting Date <Text style={styles.required}>*</Text></Text>
            <TextInput style={styles.input} value={meetingDate} onChangeText={setMeetingDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Contact Name / Business</Text>
            <TextInput style={styles.input} value={meetingName} onChangeText={setMeetingName} placeholder="e.g. Maa Tarini Traders / Ashok Sahoo" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Location / Site Address</Text>
            <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Kuakhia Market, Jajpur" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Purpose of Meeting</Text>
            <TextInput style={styles.input} value={purpose} onChangeText={setPurpose} placeholder="e.g. F2R Conversion / Slab requirement discussion" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Estimated Attendees</Text>
            <TextInput style={styles.input} value={peopleCount} onChangeText={setPeopleCount} placeholder="e.g. 5" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Next Follow-up Date <Text style={styles.optional}>(Optional)</Text></Text>
            <TextInput style={styles.input} value={nextFollowup} onChangeText={setNextFollowup} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Budget / Expense (₹) <Text style={styles.optional}>(Optional)</Text></Text>
            <TextInput style={styles.input} value={expenseAmount} onChangeText={setExpenseAmount} placeholder="e.g. 500" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Additional Notes</Text>
            <TextInput style={[styles.input, styles.textarea]} value={remark} onChangeText={setRemark} placeholder="Any extra discussion notes or requirements..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
          </View>

          <TouchableOpacity style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={mutation.isPending} activeOpacity={0.85}>
            {mutation.isPending ? <ActivityIndicator color={Colors.white} /> : (
              <View style={styles.submitBtnRow}>
                <MaterialCommunityIcons name="calendar-plus" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.submitText}>Save Meeting to Google Sheet</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 60 : Spacing['2xl'], paddingBottom: Spacing.base, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.lg },
  formCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  group: { marginBottom: Spacing.lg },
  label: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: Spacing.xs },
  required: { color: Colors.error },
  optional: { fontFamily: FontFamily.sansRegular, color: Colors.textSecondary, fontSize: 11 },
  typeRow: { flexDirection: 'row', gap: Spacing.md },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, gap: 6 },
  typeBtnText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textSecondary },
  input: { fontFamily: FontFamily.sansMedium, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.background },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnRow: { flexDirection: 'row', alignItems: 'center' },
  submitText: { fontFamily: FontFamily.sansBold, color: Colors.white, fontSize: FontSize.md, letterSpacing: 0.5 },
});