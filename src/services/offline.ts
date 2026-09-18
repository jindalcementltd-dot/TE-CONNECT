import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_KEY = 'teconnect_drafts';

export interface Draft {
  id: string;
  type: 'slab' | 'sale' | 'meeting' | 'punch';
  data: Record<string, any>;
  createdAt: string;
  synced: boolean;
}

export async function saveDraft(type: Draft['type'], data: Record<string, any>): Promise<string> {
  const drafts = await getDrafts();
  const id = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const draft: Draft = {
    id,
    type,
    data,
    createdAt: new Date().toISOString(),
    synced: false,
  };
  drafts.push(draft);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  return id;
}

export async function getDrafts(): Promise<Draft[]> {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Draft[];
  } catch {
    return [];
  }
}

export async function getUnsyncedDrafts(): Promise<Draft[]> {
  const drafts = await getDrafts();
  return drafts.filter(d => !d.synced);
}

export async function markDraftSynced(id: string): Promise<void> {
  const drafts = await getDrafts();
  const updated = drafts.map(d => d.id === id ? { ...d, synced: true } : d);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
}

export async function clearSyncedDrafts(): Promise<void> {
  const drafts = await getDrafts();
  const pending = drafts.filter(d => !d.synced);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(pending));
}
