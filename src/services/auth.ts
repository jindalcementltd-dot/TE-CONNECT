import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { apiLogin } from './api';
import { AuthSession, User } from '../types';

const SESSION_KEY = 'teconnect_session';

// In-memory cache for instant synchronous access across the app
let memorySession: AuthSession | null = null;
let memoryLoaded = false;
const authListeners = new Set<(session: AuthSession | null) => void>();

function notifyListeners(s: AuthSession | null) {
  authListeners.forEach(listener => {
    try {
      listener(s);
    } catch (e) {
      console.warn('[Auth] Listener error:', e);
    }
  });
}

export function getCachedSession(): AuthSession | null {
  return memorySession;
}

export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(memorySession);
  const [loading, setLoading] = useState(!memoryLoaded);

  useEffect(() => {
    const listener = (s: AuthSession | null) => {
      setSession(s);
      setLoading(false);
    };
    authListeners.add(listener);

    if (!memoryLoaded) {
      getSession().then(s => {
        setSession(s);
        setLoading(false);
      });
    } else {
      setSession(memorySession);
      setLoading(false);
    }

    return () => {
      authListeners.delete(listener);
    };
  }, []);

  return {
    session,
    loading,
    user: session?.user ?? null,
  };
}

async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.warn('[Storage] AsyncStorage.setItem failed:', e);
  }
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }
}

async function getStorageItem(key: string): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(key);
    if (val) return val;
  } catch {}

  if (Platform.OS !== 'web') {
    try {
      const val = await SecureStore.getItemAsync(key);
      if (val) return val;
    } catch {}
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const val = window.localStorage.getItem(key);
      if (val) return val;
    } catch {}
  }

  return null;
}

async function removeStorageItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    return hash;
  } catch (e) {
    return password;
  }
}

export async function login(login_id: string, password: string): Promise<{ user: User; token: string }> {
  const cleanLoginId = login_id.trim();
  const cleanPassword = password.trim();

  let result = await apiLogin(cleanLoginId, cleanPassword);

  // If plain password fails, attempt SHA-256 hashed password fallback
  if (!result.success || !result.data) {
    const hashed = await hashPassword(cleanPassword);
    const hashResult = await apiLogin(cleanLoginId, hashed);
    if (hashResult.success && hashResult.data) {
      result = hashResult;
    }
  }

  if (!result.success || !result.data) {
    throw new Error(result.message || 'Invalid login ID or password.');
  }

  const session: AuthSession = {
    user: result.data.user,
    token: result.data.token,
    loggedInAt: new Date().toISOString(),
  };

  // Immediate in-memory update & broadcast
  memorySession = session;
  memoryLoaded = true;
  notifyListeners(session);

  // Persistent storage (non-blocking failsafe)
  setStorageItem(SESSION_KEY, JSON.stringify(session)).catch(() => {});

  return result.data;
}

export async function getSession(): Promise<AuthSession | null> {
  if (memorySession) {
    return memorySession;
  }

  try {
    const raw = await getStorageItem(SESSION_KEY);
    if (!raw) {
      memoryLoaded = true;
      return null;
    }
    const session = JSON.parse(raw) as AuthSession;
    memorySession = session;
    memoryLoaded = true;
    return session;
  } catch {
    memoryLoaded = true;
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function logout(): Promise<void> {
  memorySession = null;
  memoryLoaded = true;
  notifyListeners(null);
  await removeStorageItem(SESSION_KEY);
}

export async function isLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
