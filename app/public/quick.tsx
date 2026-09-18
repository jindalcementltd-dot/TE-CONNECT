import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { BorderRadius, Spacing } from '../../src/theme/spacing';

export default function PublicQuickPage() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🏗️ TE CONNECT</Text>
        <Text style={styles.title}>Quick Entry</Text>
        <Text style={styles.sub}>What would you like to submit?</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.bigBtn, { borderColor: Colors.primary }]}
          onPress={() => router.push('/public/slab')}
          activeOpacity={0.8}
        >
          <Text style={styles.bigBtnEmoji}>🏗️</Text>
          <Text style={[styles.bigBtnTitle, { color: Colors.primary }]}>Add Slab</Text>
          <Text style={styles.bigBtnSub}>Submit a slab casting date</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigBtn, { borderColor: Colors.meetingCustomer }]}
          onPress={() => router.push('/public/meeting')}
          activeOpacity={0.8}
        >
          <Text style={styles.bigBtnEmoji}>🤝</Text>
          <Text style={[styles.bigBtnTitle, { color: Colors.meetingCustomer }]}>Add Meeting</Text>
          <Text style={styles.bigBtnSub}>Report a meeting with your team</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Data goes directly to Team Jajpur</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 48 },
  logo: { fontSize: 28, fontWeight: '800', color: Colors.primary, letterSpacing: 1, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  sub: { fontSize: 15, color: Colors.textSecondary, marginTop: 6 },
  buttons: { gap: 16 },
  bigBtn: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 2,
    padding: Spacing['2xl'],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  bigBtnEmoji: { fontSize: 48, marginBottom: 12 },
  bigBtnTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  bigBtnSub: { fontSize: 13, color: Colors.textSecondary },
  footer: { textAlign: 'center', marginTop: 48, fontSize: 12, color: Colors.textMuted },
});
