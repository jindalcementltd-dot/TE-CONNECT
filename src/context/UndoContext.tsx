import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { Ionicons } from '@expo/vector-icons';

interface UndoState {
  visible: boolean;
  message: string;
  onUndo: () => void;
  secondsRemaining: number;
}

interface UndoContextType {
  showUndo: (message: string, onUndo: () => void, durationSeconds?: number) => void;
  hideUndo: () => void;
}

const UndoContext = createContext<UndoContextType>({
  showUndo: () => {},
  hideUndo: () => {},
});

export const useUndo = () => useContext(UndoContext);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const timerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  const hideUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    progressAnim.setValue(1);
    setUndoState(null);
  }, [progressAnim]);

  const showUndo = useCallback((message: string, onUndo: () => void, durationSeconds = 5) => {
    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    progressAnim.setValue(1);
    setUndoState({
      visible: true,
      message,
      onUndo,
      secondsRemaining: durationSeconds,
    });

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: durationSeconds * 1000,
      useNativeDriver: false,
    }).start();

    let remaining = durationSeconds;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
      } else {
        setUndoState(prev => prev ? { ...prev, secondsRemaining: remaining } : null);
      }
    }, 1000);

    timerRef.current = setTimeout(() => {
      hideUndo();
    }, durationSeconds * 1000);
  }, [hideUndo, progressAnim]);

  const handleUndoPress = () => {
    if (undoState?.onUndo) {
      undoState.onUndo();
    }
    hideUndo();
  };

  return (
    <UndoContext.Provider value={{ showUndo, hideUndo }}>
      {children}
      {undoState?.visible ? (
        <View style={styles.floatingContainer} pointerEvents="box-none">
          <View style={styles.snackbar}>
            <View style={styles.snackbarLeft}>
              <View style={styles.timerCircle}>
                <Text style={styles.timerNum}>{undoState.secondsRemaining}s</Text>
              </View>
              <Text style={styles.snackMessage} numberOfLines={2}>
                {undoState.message}
              </Text>
            </View>

            <TouchableOpacity style={styles.undoBtn} onPress={handleUndoPress} activeOpacity={0.8}>
              <Ionicons name="arrow-undo" size={16} color="#FBBF24" style={{ marginRight: 4 }} />
              <Text style={styles.undoBtnText}>UNDO</Text>
            </TouchableOpacity>

            {/* Progress line at bottom */}
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      ) : null}
    </UndoContext.Provider>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 84 : 72,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  snackbar: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1E293B',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  snackbarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, marginRight: 8 },
  timerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  timerNum: { fontFamily: FontFamily.sansBold, fontSize: 11, color: '#F1F5F9' },
  snackMessage: { fontFamily: FontFamily.sansMedium, fontSize: 13, color: '#F8FAFC', flex: 1 },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
  },
  undoBtnText: { fontFamily: FontFamily.sansBold, fontSize: 12, color: '#FBBF24', letterSpacing: 0.5 },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: '#FBBF24',
  },
});
