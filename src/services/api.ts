import { APPS_SCRIPT_URL, API_TIMEOUT } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ApiResponse, User, Dealer, Contractor, Slab, Sale,
  ActiveTracker, Meeting, Target, Setting,
  AddSlabForm, AddSaleForm, AddMeetingForm, AddPunchForm,
  PublicSlabForm, PublicMeetingForm, DealerSalesSummary,
  TEActiveSummary, MeetingTargetSummary, TodaySummary,
  Product, BatchSaleItem
} from '../types';

class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your internet connection.');
    }
    throw new ApiError('Network error. Please check your internet connection.');
  }
}

async function get<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) throw new ApiError(`Server error: ${response.status}`);
  const json: ApiResponse<T> = await response.json();
  if (!json.success) throw new ApiError(json.message || 'Unknown error');
  return json.data as T;
}

async function post<T>(action: string, body: Record<string, any>): Promise<ApiResponse<T>> {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);

  const response = await fetchWithTimeout(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...body }),
  });
  if (!response.ok) throw new ApiError(`Server error: ${response.status}`);
  const json: ApiResponse<T> = await response.json();
  return json;
}

// ── AUTH ──────────────────────────────────────────────────
export async function apiLogin(login_id: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
  return post('login', { login_id, password });
}

// ── USERS ─────────────────────────────────────────────────
export async function apiGetUsers(): Promise<User[]> {
  return get<User[]>('getUsers');
}

// ── DEALERS ───────────────────────────────────────────────
export async function apiGetDealers(): Promise<Dealer[]> {
  try {
    const rawDealers = await get<Dealer[]>('getDealers');
    const serverDealers: Dealer[] = (rawDealers || []).map(d => ({
      ...d,
      sap_code: d.sap_code !== undefined && d.sap_code !== null ? String(d.sap_code).trim() : '',
      dealer_name: d.dealer_name !== undefined && d.dealer_name !== null ? String(d.dealer_name).trim() : '',
    }));
    const localRaw = await AsyncStorage.getItem('local_dealers');
    if (localRaw) {
      const localDealers: Dealer[] = JSON.parse(localRaw);
      const serverIds = new Set((serverDealers || []).map(d => String(d.dealer_id)));
      const serverNames = new Set((serverDealers || []).map(d => String(d.dealer_name || '').trim().toLowerCase()));
      const combined = [...(serverDealers || [])];
      localDealers.forEach(ld => {
        if (!serverIds.has(String(ld.dealer_id)) && !serverNames.has(String(ld.dealer_name || '').trim().toLowerCase())) {
          combined.push(ld);
        }
      });
      return combined;
    }
    return serverDealers;
  } catch (err) {
    const localRaw = await AsyncStorage.getItem('local_dealers');
    if (localRaw) {
      return JSON.parse(localRaw);
    }
    throw err;
  }
}

export async function apiGetDealer(dealer_id: string): Promise<Dealer> {
  return get<Dealer>('getDealer', { dealer_id });
}

export async function apiGetDealerByToken(dealer_id: string, token: string): Promise<Dealer> {
  return get<Dealer>('getDealerByToken', { dealer_id, token });
}

export async function apiAddDealer(data: {
  dealer_name: string;
  owner_name?: string;
  phone?: string;
  address?: string;
  area?: string;
  sap_code?: string;
  assigned_te?: string;
  created_by?: string;
  latitude?: number;
  longitude?: number;
}): Promise<ApiResponse<Dealer>> {
  const localDealer: Dealer = {
    dealer_id: 'DLR_' + Date.now(),
    dealer_name: data.dealer_name.trim(),
    owner_name: (data.owner_name || '').trim(),
    phone: String(data.phone || '').trim(),
    address: (data.address || '').trim(),
    area: (data.area || '').trim(),
    sap_code: (data.sap_code || '').trim(),
    latitude: data.latitude,
    longitude: data.longitude,
    assigned_te: data.assigned_te || '',
    active: true,
    qr_id: '',
    qr_token: '',
    public_slab_link: '',
    created_at: new Date().toISOString(),
  };

  // Always save locally immediately so the user never loses data and gets instant UI response
  try {
    const localRaw = await AsyncStorage.getItem('local_dealers');
    const list: Dealer[] = localRaw ? JSON.parse(localRaw) : [];
    // Check if not already in list
    if (!list.some(d => d.dealer_name.toLowerCase() === localDealer.dealer_name.toLowerCase())) {
      list.push(localDealer);
      await AsyncStorage.setItem('local_dealers', JSON.stringify(list));
    }
  } catch (e) {}

  // Attempt backend sync
  try {
    const res = await post<Dealer>('addDealer', data);
    if (res && res.success && res.data) {
      return res;
    }
  } catch (err: any) {}

  return { success: true, message: 'Dealer saved successfully!', data: localDealer };
}

// ── CONTRACTORS ────────────────────────────────────────────
export async function apiGetContractors(): Promise<Contractor[]> {
  return get<Contractor[]>('getContractors');
}

export async function apiAddContractor(data: {
  contractor_name: string;
  mobile?: string;
  area?: string;
  assigned_te: string;
}): Promise<ApiResponse<Contractor>> {
  return post('addContractor', data);
}

// ── SLABS ─────────────────────────────────────────────────
export async function apiGetSlabs(params?: { month?: string; te?: string; dealer_id?: string }): Promise<Slab[]> {
  return get<Slab[]>('getSlabs', params as any);
}

export async function apiCreateSlab(data: AddSlabForm & { created_by: string }): Promise<ApiResponse<Slab>> {
  return post('createSlab', data);
}

export async function apiUpdateSlab(slab_id: string, updates: Partial<Slab> & { updated_by: string }): Promise<ApiResponse<Slab>> {
  return post('updateSlab', { slab_id, ...updates });
}

// ── SALES ─────────────────────────────────────────────────
export async function apiGetSales(params?: { month?: string; te?: string; dealer_id?: string }): Promise<Sale[]> {
  return get<Sale[]>('getSales', params as any);
}

export async function apiCreateSale(data: AddSaleForm & { created_by: string; assigned_te: string }): Promise<ApiResponse<Sale>> {
  return post('createSale', data);
}

export async function apiCreateBatchSales(data: {
  sales: BatchSaleItem[];
  created_by: string;
}): Promise<ApiResponse<{ count: number; dealersAdded?: number }>> {
  return post('createBatchSales', data);
}

export async function apiGetDealerSalesSummary(month: string): Promise<DealerSalesSummary[]> {
  return get<DealerSalesSummary[]>('getDealerSalesSummary', { month });
}

// ── ACTIVE / PUNCH ─────────────────────────────────────────
export async function apiGetActiveTracker(params?: { month?: string; te?: string }): Promise<ActiveTracker[]> {
  return get<ActiveTracker[]>('getActiveTracker', params as any);
}

export async function apiAddPunch(data: AddPunchForm & { updated_by: string }): Promise<ApiResponse<ActiveTracker>> {
  return post('addPunch', data);
}

export async function apiUpdateContractorActivity(data: {
  te: string;
  total_contractors: number;
  active_contractors: number;
  updated_by: string;
}): Promise<ApiResponse<ActiveTracker>> {
  return post('updateContractorActivity', data);
}

export async function apiGetTEActiveSummary(month: string): Promise<TEActiveSummary[]> {
  return get<TEActiveSummary[]>('getTEActiveSummary', { month });
}

// ── MEETINGS ───────────────────────────────────────────────
export async function apiGetMeetings(params?: { month?: string; te?: string; date?: string }): Promise<Meeting[]> {
  return get<Meeting[]>('getMeetings', params as any);
}

export async function apiCreateMeeting(data: AddMeetingForm & { te: string; created_by: string }): Promise<ApiResponse<Meeting>> {
  return post('createMeeting', data);
}

export async function apiUpdateMeeting(meeting_id: string, updates: Partial<Meeting> & { updated_by: string }): Promise<ApiResponse<Meeting>> {
  return post('updateMeeting', { meeting_id, ...updates });
}

export async function apiGetMeetingTargetSummary(month: string, te?: string): Promise<MeetingTargetSummary[]> {
  return get<MeetingTargetSummary[]>('getMeetingTargetSummary', { month, ...(te ? { te } : {}) });
}

// ── TARGETS ────────────────────────────────────────────────
export async function apiGetTargets(params?: { month?: string; te?: string }): Promise<Target[]> {
  return get<Target[]>('getTargets', params as any);
}

// ── SETTINGS ───────────────────────────────────────────────
export async function apiGetSettings(): Promise<Setting[]> {
  return get<Setting[]>('getSettings');
}

export async function apiGetSetting(setting: string): Promise<string> {
  const settings = await apiGetSettings();
  const found = settings.find(s => s.setting === setting);
  return found?.value ?? '';
}

// ── TODAY SUMMARY ──────────────────────────────────────────
export async function apiGetTodaySummary(te?: string): Promise<TodaySummary> {
  return get<TodaySummary>('getTodaySummary', te ? { te } : {});
}

// ── PUBLIC ENDPOINTS (no auth) ──────────────────────────────
export async function apiPublicSlabSubmit(data: PublicSlabForm): Promise<ApiResponse<Slab>> {
  return post('publicSlabSubmit', data);
}

export async function apiPublicMeetingSubmit(data: PublicMeetingForm): Promise<ApiResponse<Meeting>> {
  return post('publicMeetingSubmit', data);
}

export { ApiError };
