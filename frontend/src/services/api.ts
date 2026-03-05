import axios from 'axios';
import type {
  DataSource,
  PaginatedResponse,
  Pipeline,
  Run,
  Skill,
  Target,
} from '../types';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || 'Request failed';
    console.error('[API Error]', message);
    return Promise.reject(error);
  }
);

// --- Skills ---
export const skillsApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<Skill>>('/skills', { params: { page, page_size: pageSize } }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<Skill>(`/skills/${id}`).then(r => r.data),
  create: (data: Partial<Skill>) =>
    apiClient.post<Skill>('/skills', data).then(r => r.data),
  update: (id: string, data: Partial<Skill>) =>
    apiClient.put<Skill>(`/skills/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    apiClient.delete(`/skills/${id}`),
};

// --- Pipelines ---
export const pipelinesApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<Pipeline>>('/pipelines', { params: { page, page_size: pageSize } }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<Pipeline>(`/pipelines/${id}`).then(r => r.data),
  create: (data: Partial<Pipeline>) =>
    apiClient.post<Pipeline>('/pipelines', data).then(r => r.data),
  update: (id: string, data: Partial<Pipeline>) =>
    apiClient.put<Pipeline>(`/pipelines/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    apiClient.delete(`/pipelines/${id}`),
};

// --- Data Sources ---
export const dataSourcesApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<DataSource>>('/data-sources', { params: { page, page_size: pageSize } }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<DataSource>(`/data-sources/${id}`).then(r => r.data),
  create: (data: Partial<DataSource>) =>
    apiClient.post<DataSource>('/data-sources', data).then(r => r.data),
  update: (id: string, data: Partial<DataSource>) =>
    apiClient.put<DataSource>(`/data-sources/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    apiClient.delete(`/data-sources/${id}`),
};

// --- Targets ---
export const targetsApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<Target>>('/targets', { params: { page, page_size: pageSize } }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<Target>(`/targets/${id}`).then(r => r.data),
  create: (data: Partial<Target>) =>
    apiClient.post<Target>('/targets', data).then(r => r.data),
  update: (id: string, data: Partial<Target>) =>
    apiClient.put<Target>(`/targets/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    apiClient.delete(`/targets/${id}`),
};

// --- Runs ---
export const runsApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<PaginatedResponse<Run>>('/runs', { params: { page, page_size: pageSize } }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<Run>(`/runs/${id}`).then(r => r.data),
  create: (data: Partial<Run>) =>
    apiClient.post<Run>('/runs', data).then(r => r.data),
};

export default apiClient;
