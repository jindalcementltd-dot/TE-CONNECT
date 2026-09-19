import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { apiPublicMeetingSubmit } from '../../src/services/api';
import { currentDateISO } from '../../src/utils/helpers';
import { MeetingType } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function PublicMeetingPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [meetingDate, setMeetingDate] = useState(currentDateISO());
  const [meetingType, setMeetingType] = useState<MeetingType>('CUSTOMER');
  const [meetingName, setMeetingName] = useState('');
  const [location, setLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [remark, setRemark] = useState('');

  const handleSubmit = async () => {
    if (!meetingDate || !meetingType) { Alert.alert('Missing Fields', 'Date and meeting type are required.'); return; }
    setLoading(true);
    try {
      const res = await apiPublicMeetingSubmit({
        meeting_date: meetingDate,
        meeting_type: meetingType,
        meeting_name: meetingName,
        location,
        purpose,
        people_count: peopleCount ? Number(peopleCount) : undefined,
        remark
      });
      if (res.success) setSubmitted(true);
      else Alert.alert('Error', res.message || 'Failed to submit meeting.');
    } catch (e: any) { Alert.alert('Error', e.message || 'Network error.'); }
    finally { setLoading(false); }
  };

  if (submitted) return (
    <SafeAreaView style={styles.center}>
      <View style={[styles.statusIconCircle, { backgroundColor: '#DCFCE7' }]}>
        <MaterialCommunityIcons name="check-decagram" size={54} color="#15803D" />
      </View>
      <Text style={styles.successTitle}>Meeting Submitted!</Text>
      <Text style={styles.successSub}>Thank you! Your meeting report has been synced directly to Team Jajpur Google Sheets.</Text>
    </SafeAreaView>
  );

  const types: { type: MeetingType; label: string; icon: any; color: string; bg: string }[] = [
    { type: 'CUSTOMER', label: 'Customer', icon: 'account-tie', color: '#800E20', bg: '#FBE8EC' },
    { type: 'CONTRACTOR', label: 'Contractor', icon: 'account-hard-hat', color: '#C2410C', bg: '#FFEDD5' },
    { type: 'OTHER', label: 'Other', icon: 'account-group', color: '#0F766E', bg: '#CCFBF1' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.appNameTE}>TE </Text>
          <Text style={styles.appNameCONNECT}>CONNECT</Text>
        </View>
        <Text style={styles.subtitle}>Direct Field Meeting Submission</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <View style={styles.group}>
            <Text style={styles.label}>Meeting Type <Text style={styles.required}>*</Text></Text>
            <View style={styles.typeRow}>
              {types.map(t => {
                const isSelected = meetingType === t.type;
                return (
                  <TouchableOpacity
                    key={t.type}
                    style={[
                      styles.typeBtn,
                      isSelected && { backgroundColor: t.bg, borderColor: t.color, borderWidth: 2 }
                    ]}
                    onPress={() => setMeetingType(t.type)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={t.icon} size={22} color={isSelected ? t.color : '#8A7277'} />
                    <Text style={[styles.typeLabel, isSelected && { color: t.color, fontWeight: '800' }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

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

          <View style={styles.group}>
            <Text style={styles.label}>Your Name / Counter Name</Text>
            <TextInput
              style={styles.input}
              value={meetingName}
              onChangeText={setMeetingName}
              placeholder="Contact or counter name"
              placeholderTextColor="#A0858C"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Location / Area</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Meeting location or village"
              placeholderTextColor="#A0858C"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Purpose of Meet</Text>
            <TextInput
              style={styles.input}
              value={purpose}
              onChangeText={setPurpose}
              placeholder="Discussion agenda or requirement"
              placeholderTextColor="#A0858C"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Attendees Count</Text>
            <TextInput
              style={styles.input}
              value={peopleCount}
              onChangeText={setPeopleCount}
              keyboardType="numeric"
              placeholder="Number of participants"
              placeholderTextColor="#A0858C"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Remarks / Summary</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={remark}
              onChangeText={setRemark}
              placeholder="Notes from meeting..."
              placeholderTextColor="#A0858C"
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit Meeting Report 🤝</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
  },
  center: {
    flex: 1,
    backgroundColor: '#F9F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  statusIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appNameTE: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: 1,
  },
  appNameCONNECT: {
    fontSize: 24,
    fontWeight: '900',
    color: '#800E20',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: '#8A7277',
    marginTop: 4,
    fontWeight: '600',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
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
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B4E55',
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
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#15803D',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 14,
    color: '#6B4E55',
    textAlign: 'center',
    lineHeight: 20,
  },
});

