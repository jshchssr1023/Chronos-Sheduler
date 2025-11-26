// =============================================================================
// AITX Chronos Scheduler - API Service
// =============================================================================

import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import type {
  ApiResponse,
  PaginatedResponse,
  CountResponse,
  Car,
  Shop,
  Assignment,
  Scenario,
  DashboardData,
  ShopUtilization,
  ShopPerformance,
  UtilizationSeries,
  ForecastData,
  EvaluationResult,
  HistoryState,
  CarFilters,
  CarFormData,
  ShopFormData,
  AssignmentFormData,
  ScenarioAssignment,
  CarStats,
} from '../types';

// -----------------------------------------------------------------------------
// API Client Configuration
// -----------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// -----------------------------------------------------------------------------
// Cars API
// -----------------------------------------------------------------------------

export const carsApi = {
  getAll: async (filters?: CarFilters): Promise<PaginatedResponse<Car>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const { data } = await apiClient.get<PaginatedResponse<Car>>(`/cars?${params}`);
    return data;
  },

  getById: async (id: number): Promise<Car> => {
    const { data } = await apiClient.get<ApiResponse<Car>>(`/cars/${id}`);
    return data.data;
  },

  create: async (car: CarFormData): Promise<Car> => {
    const { data } = await apiClient.post<ApiResponse<Car>>('/cars', car);
    return data.data;
  },

  update: async (id: number, car: Partial<CarFormData>): Promise<Car> => {
    const { data } = await apiClient.put<ApiResponse<Car>>(`/cars/${id}`, car);
    return data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/cars/${id}`);
  },

  bulkImport: async (file: File): Promise<{ count: number; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post('/cars/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  exportXlsx: async (): Promise<Blob> => {
    const response = await apiClient.get('/cars/export/xlsx', {
      responseType: 'blob',
    });
    return response.data;
  },

  downloadTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get('/cars/template/download', {
      responseType: 'blob',
    });
    return response.data;
  },

  getStats: async (): Promise<CarStats> => {
    const { data } = await apiClient.get<ApiResponse<CarStats>>('/cars/stats/summary');
    return data.data;
  },
};

// -----------------------------------------------------------------------------
// Shops API
// -----------------------------------------------------------------------------

export const shopsApi = {
  getAll: async (): Promise<Shop[]> => {
    const { data } = await apiClient.get<CountResponse<Shop>>('/shops');
    return data.data;
  },

  getById: async (id: number): Promise<Shop> => {
    const { data } = await apiClient.get<ApiResponse<Shop>>(`/shops/${id}`);
    return data.data;
  },

  create: async (shop: ShopFormData): Promise<Shop> => {
    const { data } = await apiClient.post<ApiResponse<Shop>>('/shops', shop);
    return data.data;
  },

  update: async (id: number, shop: Partial<ShopFormData>): Promise<Shop> => {
    const { data } = await apiClient.put<ApiResponse<Shop>>(`/shops/${id}`, shop);
    return data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/shops/${id}`);
  },

  upload: async (file: File): Promise<{ shopsCreated: number; carsUnassigned: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post('/shops/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.stats;
  },

  downloadTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get('/shops/template/download', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// -----------------------------------------------------------------------------
// Schedule API
// -----------------------------------------------------------------------------

export const scheduleApi = {
  getAssignments: async (month?: string, shopId?: number): Promise<Assignment[]> => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (shopId) params.append('shopId', String(shopId));
    const { data } = await apiClient.get<CountResponse<Assignment>>(`/schedule/assignments?${params}`);
    return data.data;
  },

  getUnassigned: async (): Promise<Car[]> => {
    const { data } = await apiClient.get<CountResponse<Car>>('/schedule/unassigned');
    return data.data;
  },

  assign: async (assignment: AssignmentFormData): Promise<Assignment> => {
    const { data } = await apiClient.post<ApiResponse<Assignment>>('/schedule/assign', assignment);
    return data.data;
  },

  unassign: async (assignmentId: number): Promise<void> => {
    await apiClient.delete(`/schedule/unassign/${assignmentId}`);
  },

  getUtilization: async (month: string): Promise<ShopUtilization[]> => {
    const { data } = await apiClient.get<ApiResponse<ShopUtilization[]>>(`/schedule/utilization?month=${month}`);
    return data.data;
  },

  undo: async (): Promise<HistoryState> => {
    const { data } = await apiClient.post<ApiResponse<HistoryState>>('/schedule/undo');
    return data as unknown as HistoryState;
  },

  redo: async (): Promise<HistoryState> => {
    const { data } = await apiClient.post<ApiResponse<HistoryState>>('/schedule/redo');
    return data as unknown as HistoryState;
  },

  getHistory: async (): Promise<HistoryState> => {
    const { data } = await apiClient.get<ApiResponse<HistoryState>>('/schedule/history');
    return data.data;
  },
};

// -----------------------------------------------------------------------------
// Analytics API
// -----------------------------------------------------------------------------

export const analyticsApi = {
  getDashboard: async (): Promise<DashboardData> => {
    const { data } = await apiClient.get<ApiResponse<DashboardData>>('/analytics/dashboard');
    return data.data;
  },

  getUtilization: async (
    startMonth: string,
    endMonth: string,
    shopId?: number
  ): Promise<UtilizationSeries[]> => {
    const params = new URLSearchParams({ startMonth, endMonth });
    if (shopId) params.append('shopId', String(shopId));
    const { data } = await apiClient.get<ApiResponse<UtilizationSeries[]>>(`/analytics/utilization?${params}`);
    return data.data;
  },

  getShopPerformance: async (): Promise<ShopPerformance[]> => {
    const { data } = await apiClient.get<ApiResponse<ShopPerformance[]>>('/analytics/shop-performance');
    return data.data;
  },

  getForecast: async (months?: number): Promise<ForecastData[]> => {
    const params = months ? `?months=${months}` : '';
    const { data } = await apiClient.get<ApiResponse<ForecastData[]>>(`/analytics/forecast${params}`);
    return data.data;
  },

  getPriorityDistribution: async (): Promise<{ shopId: number; shopName: string; priorities: Record<string, number> }[]> => {
    const { data } = await apiClient.get<ApiResponse<{ shopId: number; shopName: string; priorities: Record<string, number> }[]>>(
      '/analytics/priority-distribution'
    );
    return data.data;
  },
};

// -----------------------------------------------------------------------------
// Scenarios API
// -----------------------------------------------------------------------------

export const scenariosApi = {
  getAll: async (): Promise<Scenario[]> => {
    const { data } = await apiClient.get<CountResponse<Scenario>>('/scenarios');
    return data.data;
  },

  getById: async (id: number): Promise<Scenario> => {
    const { data } = await apiClient.get<ApiResponse<Scenario>>(`/scenarios/${id}`);
    return data.data;
  },

  create: async (name: string, scenarioData?: { description?: string; assignments?: ScenarioAssignment[] }): Promise<Scenario> => {
    const { data } = await apiClient.post<ApiResponse<Scenario>>('/scenarios', {
      name,
      data: scenarioData || {},
    });
    return data.data;
  },

  update: async (id: number, updates: { name?: string; data?: unknown }): Promise<Scenario> => {
    const { data } = await apiClient.put<ApiResponse<Scenario>>(`/scenarios/${id}`, updates);
    return data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/scenarios/${id}`);
  },

  evaluate: async (assignments: ScenarioAssignment[]): Promise<EvaluationResult> => {
    const { data } = await apiClient.post<ApiResponse<EvaluationResult>>('/scenarios/evaluate', { assignments });
    return data.data;
  },

  apply: async (id: number): Promise<{ count: number; message: string }> => {
    const { data } = await apiClient.post(`/scenarios/${id}/apply`);
    return data;
  },

  export: async (scenarioId?: number, fitResults?: EvaluationResult): Promise<Blob> => {
    const response = await apiClient.post(
      '/scenarios/export',
      { scenarioId, fitResults },
      { responseType: 'blob' }
    );
    return response.data;
  },
};

// -----------------------------------------------------------------------------
// Health Check
// -----------------------------------------------------------------------------

export const healthCheck = async (): Promise<boolean> => {
  try {
    await apiClient.get('/health');
    return true;
  } catch {
    return false;
  }
};

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default apiClient;
