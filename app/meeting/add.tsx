import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
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
    CUSTOMER: { label: 'Customer', icon: 'account-tie', color: '#800E20', bg: '#FBE8EC' },
    CONTRACTOR: { label: 'Contractor', icon: 'account-hard-hat', color: '#C2410C', bg: '#FFEDD5' },
    OTHER: { label: 'Other', icon: 'account-group', color: '#0F766E', bg: '#CCFBF1' },
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#1F0B10" />
        </TouchableOpacity>
        <Text style={styles.title}>Schedule Meeting</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          {/* Meeting Type */}
          <View style={styles.group}>
            <Text style={styles.label}>Meeting Type <Text style={styles.required}>*</Text></Text>
            <View style={styles.typeRow}>
              {(Object.entries(typeConfig) as [MeetingType, any][]).map(([type, cfg]) => {
                const isSelected = meetingType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeBtn,
                      isSelected && { backgroundColor: cfg.bg, borderColor: cfg.color, borderWidth: 2 }
                    ]}
                    onPress={() => setMeetingType(type)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={cfg.icon} size={22} color={isSelected ? cfg.color : '#8A7277'} />
                    <Text style={[styles.typeBtnText, isSelected && { color: cfg.color, fontWeight: '800' }]}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Meeting Date */}
          <View style={styles.group}>
            <Text style={styles.label}>Meeting Date <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={meetingDate}
              onChangeText={setMeetingDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A0858C"
            />
          </View>

          {/* Contact / Client Name */}
          <View style={styles.group}>
            <Text style={styles.label}>Contact Name / Business</Text>
            <TextInput
              style={styles.input}
              value={meetingName}
              onChangeText={setMeetingName}
              placeholder="e.g. Maa Tarini Traders / Ashok Sahoo"
              placeholderTextColor="#A0858C"
            />
          </View>

          {/* Location */}
          <View style={styles.group}>
            <Text style={styles.label}>Location / Site Address</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Kuakhia Market, Jajpur"
              placeholderTextColor="#A0858C"
            />
          </View>

          {/* Purpose */}
          <View style={styles.group}>
            <Text style={styles.label}>Purpose of Meeting</Text>
            <TextInput
              style={styles.input}
              value={purpose}
              onChangeText={setPurpose}
              placeholder="e.g. F2R Conversion / Slab requirement discussion"
              placeholderTextColor="#A0858C"
            />
          </View>

          {/* People Count */}
          <View style={styles.group}>
            <Text style={styles.label}>Estimated Attendees</Text>
            <TextInput
              style={styles.input}
              value={peopleCount}
              onChangeText={setPeopleCount}
              placeholder="e.g. 5"
              placeholderTextColor="#A0858C"
              keyboardType="numeric"
            />
          </View>

          {/* Next Follow-up */}
          <View style={styles.group}>
            <Text style={styles.label}>Next Follow-up Date <Text style={styles.optional}>(Optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={nextFollowup}
              onChangeText={setNextFollowup}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A0858C"
            />
          </View>

          {/* Expense Amount */}
          <View style={styles.group}>
            <Text style={styles.label}>Budget / Expense (₹) <Text style={styles.optional}>(Optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              placeholder="e.g. 500"
              placeholderTextColor="#A0858C"
              keyboardType="numeric"
            />
          </View>

          {/* Remark */}
          <View style={styles.group}>
            <Text style={styles.label}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={remark}
              onChangeText={setRemark}
              placeholder="Any extra discussion notes or requirements..."
              placeholderTextColor="#A0858C"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.submitBtnRow}>
                <MaterialCommunityIcons name="calendar-plus" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitText}>Save Meeting to Google Sheet</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
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
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  group: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F0B10',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  optional: {
    color: '#8A7277',
    fontWeight: '400',
    fontSize: 11,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    backgroundColor: '#FAF6F7',
    gap: 6,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B4E55',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F0B10',
    backgroundColor: '#FAF6F7',
    fontWeight: '600',
  },
  textarea: {
    height: 76,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#800E20',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});