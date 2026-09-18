import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiPublicMeetingSubmit } from '../../src/services/api';
import { currentDateISO } from '../../src/utils/helpers';
import { MeetingType } from '../../src/types';

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
    if (!meetingDate || !meetingType) { Alert.alert('Missing', 'Date and type are required.'); return; }
    setLoading(true);
    try {
      const res = await apiPublicMeetingSubmit({ meeting_date: meetingDate, meeting_type: meetingType, meeting_name: meetingName, location, purpose, people_count: peopleCount ? Number(peopleCount) : undefined, remark });
      if (res.success) setSubmitted(true);
      else Alert.alert('Error', res.message);
    } catch (e: any) { Alert.alert('Error', e.message || 'Network error.'); }
    finally { setLoading(false); }
  };

  if (submitted) return (
    <SafeAreaView style={styles.center}>
      <Text style={{ fontSize: 56, marginBottom: 16 }}>✅</Text>
      <Text style={styles.successTitle}>Meeting Submitted!</Text>
      <Text style={{ fontSize: 15, color: Colors.textSecondary, textAlign: 'center' }}>Thank you! Your team has been notified.</Text>
    </SafeAreaView>
  );

  const types: { type: MeetingType; label: string; emoji: string }[] = [
    { type: 'CUSTOMER', label: 'Customer', emoji: '🏪' },
    { type: 'CONTRACTOR', label: 'Contractor', emoji: '👷' },
    { type: 'OTHER', label: 'Other', emoji: '🤝' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🤝 TE CONNECT</Text>
        <Text style={styles.subtitle}>Meeting Submission</Text>
      </View>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <Text style={styles.label}>Meeting Type *</Text>
          <View style={styles.typeRow}>
            {types.map(t => (
              <TouchableOpacity
                key={t.type}
                style={[styles.typeBtn, meetingType === t.type && styles.typeBtnActive]}
                onPress={() => setMeetingType(t.type)}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeLabel, meetingType === t.type && styles.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.group}><Text style={styles.label}>Meeting Date *</Text><TextInput style={styles.input} value={meetingDate} onChangeText={setMeetingDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} /></View>
        <View style={styles.group}><Text style={styles.label}>Your Name</Text><TextInput style={styles.input} value={meetingName} onChangeText={setMeetingName} placeholder="Your name" placeholderTextColor={Colors.textMuted} /></View>
        <View style={styles.group}><Text style={styles.label}>Location <Text style={styles.optional}>(Optional)</Text></Text><TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Meeting location" placeholderTextColor={Colors.textMuted} /></View>
        <View style={styles.group}><Text style={styles.label}>Purpose <Text style={styles.optional}>(Optional)</Text></Text><TextInput style={styles.input} value={purpose} onChangeText={setPurpose} placeholder="Purpose" placeholderTextColor={Colors.textMuted} /></View>
        <View style={styles.group}><Text style={styles.label}>People Count <Text style={styles.optional}>(Optional)</Text></Text><TextInput style={styles.input} value={peopleCount} onChangeText={setPeopleCount} keyboardType="numeric" placeholder="Number of people" placeholderTextColor={Colors.textMuted} /></View>
        <View style={styles.group}><Text style={styles.label}>Remark <Text style={styles.optional}>(Optional)</Text></Text><TextInput style={[styles.input, styles.textarea]} value={remark} onChangeText={setRemark} placeholder="Notes..." placeholderTextColor={Colors.textMuted} multiline /></View>
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Submit Meeting →</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  logo: { fontSize: 22, fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  scroll: { flex: 1, padding: Spacing.base },
  group: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 7 },
  optional: { color: Colors.textMuted, fontWeight: '400', fontSize: 11 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: Colors.textPrimary, backgroundColor: Colors.white },
  textarea: { height: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  typeLabelActive: { color: Colors.primary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: 17, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.success, marginBottom: 8 },
});
