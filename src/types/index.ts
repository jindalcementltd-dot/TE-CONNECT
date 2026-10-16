// TE CONNECT — TypeScript Interfaces

export type UserRole = 'ADMIN' | 'MANAGER' | 'TE' | 'SALES_OPERATOR';

export interface User {
  user_id: string;
  login_id: string;
  name: string;
  role: UserRole;
  team: string;
  district: string;
  territory: string;
  phone: string;
  active: boolean;
  photo_url?: string;
  created_at: string;
}

export interface AuthSession {
  user: User;
  token: string;
  loggedInAt: string;
}

export interface Dealer {
  dealer_id: string;
  dealer_name: string;
  owner_name: string;
  phone: string;
  address: string;
  area: string;
  sap_code?: string;
  latitude?: number;
  longitude?: number;
  assigned_te: string;
  active: boolean;
  qr_id: string;
  qr_token: string;
  public_slab_link: string;
  created_at: string;
}

export interface Contractor {
  contractor_id: string;
  contractor_name: string;
  mobile: string;
  area: string;
  assigned_te: string;
  active: boolean;
  created_at: string;
}

export type SlabStatus = 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
export type SlabSource = 'APP' | 'DEALER_QR' | 'PUBLIC_LINK';

export interface Slab {
  slab_id: string;
  slab_date: string; // YYYY-MM-DD
  dealer_id: string;
  dealer_name: string;
  contractor_name: string;
  customer_name?: string;
  expected_cement: string;
  latitude?: number;
  longitude?: number;
  assigned_te: string;
  status: SlabStatus;
  remark?: string;
  source: SlabSource;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type Product = 'ACC F2R' | 'ACC GOLD' | 'ACC HPC' | string;

export interface Sale {
  sale_id: string;
  sale_date: string;
  dealer_id: string;
  dealer_name: string;
  product: Product;
  quantity_bags: number;
  assigned_te: string;
  source: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActiveTracker {
  tracker_id: string;
  date: string;
  month: string;
  te: string;
  total_contractors: number;
  active_contractors: number;
  inactive_contractors: number;
  punched_quantity_bags: number;
  f2r_punch_bags?: number;
  gold_punch_bags?: number;
  updated_by: string;
  updated_at: string;
}

export type MeetingType = 'CUSTOMER' | 'CONTRACTOR' | 'OTHER';
export type MeetingStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
export type MeetingSource = 'APP' | 'PUBLIC_LINK';

export interface Meeting {
  meeting_id: string;
  meeting_date: string;
  te: string;
  meeting_type: MeetingType;
  meeting_name: string;
  location?: string;
  purpose?: string;
  people_count?: number;
  status: MeetingStatus;
  outcome?: string;
  next_followup?: string;
  expense_amount?: number;
  remark?: string;
  source: MeetingSource;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Target {
  target_id: string;
  month: string; // YYYY-MM
  year: string;
  te: string;
  active_target: number; // percentage e.g. 80
  customer_meeting_target: number;
  contractor_meeting_target: number;
}

export interface Setting {
  setting: string;
  value: string;
}

export interface ActivityLog {
  activity_id: string;
  user_id: string;
  user_name: string;
  action: string;
  module: string;
  record_id: string;
  timestamp: string;
  details: string;
}

// Computed / Display types
export interface DealerSalesSummary {
  dealer_id: string;
  dealer_name: string;
  area: string;
  sap_code?: string;
  assigned_te: string;
  active: boolean;
  total_bags: number;
  total_mt: number;
  f2r_bags: number;
  gold_bags: number;
}

export interface TEActiveSummary {
  te: string;
  total_sales_bags: number;
  required_punch_bags: number;
  actual_punch_bags: number;
  active_percent: number;
  gap_bags: number;
  total_contractors: number;
  active_contractors: number;
  inactive_contractors: number;
}

export interface MeetingTargetSummary {
  te: string;
  month: string;
  customer_target: number;
  customer_completed: number;
  contractor_target: number;
  contractor_completed: number;
  total_planned: number;
  total_completed: number;
}

export interface TodaySummary {
  slabs_today: number;
  sales_bags_today: number;
  meetings_today: number;
  active_percent: number;
}

export interface MonthlyPerformance {
  sales_mt: number;
  active_percent: number;
  meetings_completed: number;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

// Form types
export interface AddSlabForm {
  slab_date: string;
  dealer_id: string;
  dealer_name: string;
  contractor_name: string;
  customer_name?: string;
  expected_cement: string;
  latitude?: number;
  longitude?: number;
  assigned_te: string;
  remark?: string;
}

export interface AddSaleForm {
  sale_date: string;
  dealer_id: string;
  dealer_name: string;
  product: Product;
  quantity_bags: number;
  remark?: string;
}

export interface AddMeetingForm {
  meeting_date: string;
  meeting_type: MeetingType;
  meeting_name: string;
  location?: string;
  purpose?: string;
  people_count?: number;
  outcome?: string;
  next_followup?: string;
  expense_amount?: number;
  remark?: string;
}

export interface AddPunchForm {
  date: string;
  te: string;
  punch_quantity_bags?: number;
  f2r_bags?: number;
  gold_bags?: number;
  total_contractors?: number;
  active_contractors?: number;
  remark?: string;
}

export interface PublicSlabForm {
  dealer_id: string;
  dealer_name: string;
  token: string;
  slab_date: string;
  contractor_name: string;
  customer_name?: string;
  expected_cement: string;
  latitude?: number;
  longitude?: number;
  remark?: string;
}

export interface PublicMeetingForm {
  meeting_date: string;
  meeting_type: MeetingType;
  meeting_name: string;
  location?: string;
  purpose?: string;
  people_count?: number;
  remark?: string;
}

export interface ScannedDealerSale {
  sap_code: string;
  dealer_name: string;
  matched_dealer_id?: string;
  hpc_mt: number;
  f2r_mt: number;
  gold_mt: number;
  total_mt: number;
  hpc_bags: number;
  f2r_bags: number;
  gold_bags: number;
  total_bags: number;
  selected: boolean;
}

export interface VisionScanResult {
  success: boolean;
  error?: string;
  dealers: ScannedDealerSale[];
  summary: {
    total_dealers: number;
    active_dealers: number;
    total_mt: number;
    total_f2r_mt: number;
    total_gold_mt: number;
    total_hpc_mt: number;
    total_bags: number;
    total_f2r: number;
    total_gold: number;
    total_hpc: number;
  };
}

export interface BatchSaleItem {
  sale_date: string;
  dealer_id?: string;
  dealer_name: string;
  sap_code?: string;
  product: Product;
  quantity_bags: number;
  assigned_te?: string;
  remark?: string;
}

