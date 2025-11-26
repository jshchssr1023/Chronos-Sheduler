/**
 * Frontend Type Definitions for Chronos Scheduler
 */

// ============================================
// ENUMS AND TYPES
// ============================================

export type CarPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type CarStatus = 'unscheduled' | 'scheduled' | 'in_progress' | 'completed' | 'on_hold';
export type DemandType = 'Fleet Growth' | 'Lease Expiry' | 'Regulatory' | 'Maintenance Cycle' | 'Customer Request' | 'Emergency Repair';
export type ShopOwnership = 'AITX-Owned' | 'Third-Party';
export type ShopType = 'AAR Certified' | 'AITX-Owned' | 'Contracted' | 'Partner' | 'Emergency Only';
export type UserRole = 'super_admin' | 'company_admin' | 'scheduler' | 'shop_manager' | 'viewer';

// ============================================
// INTERFACES
// ============================================

export interface Car {
  id: string;
  company_id: string;
  car_mark: string;
  car_type?: string;
  level2_car_type?: string;
  commodity?: string;
  demand_type: DemandType;
  qual_date?: string;
  lease_expiry_date?: string;
  regulatory_cycle_years?: number;
  estimated_duration_days: number;
  target_cost_per_car?: number;
  customer?: string;
  owner?: string;
  fleet_id?: string;
  priority: CarPriority;
  assigned_shop_id?: string | null;
  start_date?: string;
  end_date?: string;
  status: CarStatus;
  work_scope?: string;
  archived: boolean;
  notes?: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  shop?: {
    id: string;
    name: string;
    location: string;
    ownership?: string;
  };
}

export interface ShopCapabilities {
  welding: boolean;
  painting: boolean;
  wheel_work: boolean;
  tank_interior: boolean;
  structural_repair: boolean;
  regulatory_inspection: boolean;
  lining: boolean;
  valve_repair: boolean;
  cleaning: boolean;
  stenciling: boolean;
  [key: string]: boolean;
}

export interface Shop {
  id: string;
  company_id: string;
  name: string;
  location: string;
  ownership: ShopOwnership;
  shop_type: ShopType;
  type?: string;  // Legacy field
  capacity?: number;
  weekly_capacity: number;
  monthly_capacity: number;
  annual_target: number;
  capabilities: ShopCapabilities;
  cost_index: number;
  booking_lead_time_days: number;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  quality_rating?: number;
  avg_turnaround_days?: number;
  region?: string;
  railroad_access: string[];
  preferred_commodities: string[];
  active: boolean;
  metadata?: string;
  created_at: string;
  updated_at: string;
  // Computed fields
  active_cars?: number;
  utilization_percentage?: number;
  available_capacity?: number;
}

export interface User {
  id: string;
  company_id: string;
  company_name?: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  shop_id?: string;
  shop_name?: string;
  last_login_at?: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  company_id: string;
  car_id: string;
  shop_id: string;
  assigned_by?: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

// ============================================
// FORM DATA INTERFACES
// ============================================

export interface CarFormData {
  car_mark: string;
  car_type?: string;
  commodity?: string;
  demand_type: DemandType;
  qual_date?: string;
  lease_expiry_date?: string;
  regulatory_cycle_years?: number;
  estimated_duration_days?: number;
  target_cost_per_car?: number;
  customer?: string;
  owner?: string;
  priority: CarPriority;
  work_scope?: string;
}

export interface ShopFormData {
  name: string;
  location: string;
  ownership: ShopOwnership;
  shop_type: ShopType;
  weekly_capacity?: number;
  monthly_capacity?: number;
  annual_target?: number;
  capabilities?: Partial<ShopCapabilities>;
  cost_index?: number;
  booking_lead_time_days?: number;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  region?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ============================================
// CONSTANTS
// ============================================

export const CAR_PRIORITIES: CarPriority[] = ['Critical', 'High', 'Medium', 'Low'];
export const CAR_STATUSES: CarStatus[] = ['unscheduled', 'scheduled', 'in_progress', 'completed', 'on_hold'];
export const DEMAND_TYPES: DemandType[] = [
  'Fleet Growth', 
  'Lease Expiry', 
  'Regulatory', 
  'Maintenance Cycle', 
  'Customer Request', 
  'Emergency Repair'
];
export const SHOP_OWNERSHIPS: ShopOwnership[] = ['AITX-Owned', 'Third-Party'];
export const SHOP_TYPES: ShopType[] = [
  'AAR Certified', 
  'AITX-Owned', 
  'Contracted', 
  'Partner', 
  'Emergency Only'
];
export const USER_ROLES: UserRole[] = [
  'super_admin', 
  'company_admin', 
  'scheduler', 
  'shop_manager', 
  'viewer'
];

export const DEFAULT_SHOP_CAPABILITIES: ShopCapabilities = {
  welding: false,
  painting: false,
  wheel_work: false,
  tank_interior: false,
  structural_repair: false,
  regulatory_inspection: false,
  lining: false,
  valve_repair: false,
  cleaning: false,
  stenciling: false
};

export const COMMON_COMMODITIES = [
  'Crude Oil',
  'Refined Petroleum',
  'Ethanol',
  'LPG',
  'Chemicals',
  'Plastics',
  'Grain',
  'Corn',
  'Soybeans',
  'Fertilizer',
  'Coal',
  'Iron Ore',
  'Steel Coils',
  'Lumber',
  'Paper Products',
  'Cement',
  'Sand/Gravel',
  'Potash',
  'Sulfuric Acid',
  'Chlorine'
];

export const COMMON_CAR_TYPES = [
  'Tank Car',
  'Covered Hopper',
  'Open Hopper',
  'Boxcar',
  'Gondola',
  'Flat Car',
  'Refrigerated Car',
  'Auto Rack',
  'Intermodal',
  'Center Beam',
  'Coil Car'
];

export const COMMON_REGIONS = [
  'Northeast',
  'Southeast',
  'Midwest',
  'Southwest',
  'West Coast',
  'Gulf Coast',
  'Pacific Northwest',
  'Mountain West',
  'Great Plains',
  'Mid-Atlantic'
];

// ============================================
// UI STYLE CONSTANTS
// ============================================

export const PRIORITY_COLORS: Record<CarPriority, string> = {
  Critical: 'bg-red-100 text-red-800 border-red-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Low: 'bg-green-100 text-green-800 border-green-200'
};

export const STATUS_COLORS: Record<CarStatus, string> = {
  unscheduled: 'bg-gray-100 text-gray-800 border-gray-200',
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  on_hold: 'bg-yellow-100 text-yellow-800 border-yellow-200'
};

export const DEMAND_TYPE_COLORS: Record<DemandType, string> = {
  'Fleet Growth': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Lease Expiry': 'bg-amber-100 text-amber-800 border-amber-200',
  'Regulatory': 'bg-red-100 text-red-800 border-red-200',
  'Maintenance Cycle': 'bg-blue-100 text-blue-800 border-blue-200',
  'Customer Request': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Emergency Repair': 'bg-rose-100 text-rose-800 border-rose-200'
};

export const SHOP_TYPE_COLORS: Record<ShopType, string> = {
  'AAR Certified': 'bg-green-100 text-green-800 border-green-200',
  'AITX-Owned': 'bg-blue-100 text-blue-800 border-blue-200',
  'Contracted': 'bg-purple-100 text-purple-800 border-purple-200',
  'Partner': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Emergency Only': 'bg-red-100 text-red-800 border-red-200'
};

export const OWNERSHIP_COLORS: Record<ShopOwnership, string> = {
  'AITX-Owned': 'bg-blue-100 text-blue-800 border-blue-200',
  'Third-Party': 'bg-purple-100 text-purple-800 border-purple-200'
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(date: string | undefined | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(date: string | undefined | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getUtilizationColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-orange-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function getUtilizationTextColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-600';
  if (percentage >= 75) return 'text-orange-600';
  if (percentage >= 50) return 'text-yellow-600';
  return 'text-green-600';
}

export function getUtilizationBgColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-100';
  if (percentage >= 75) return 'bg-orange-100';
  if (percentage >= 50) return 'bg-yellow-100';
  return 'bg-green-100';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatCapabilityName(key: string): string {
  return key
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
}
