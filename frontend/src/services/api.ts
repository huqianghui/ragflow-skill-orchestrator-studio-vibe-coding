import axios from 'axios';
import type {
  Connection,
  ConnectionTestResult,
  DataSource,
  PaginatedResponse,
  Pipeline,
  PreloadedImports,
  Run,
  Skill,
  SkillTestResult,
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
  list: (page = 1, pageSize = 50) =>
    apiClient.get<PaginatedResponse<Skill>>('/skills', { params: { page, page_size: pageSize } }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<Skill>(`/skills/${id}`).then(r => r.data),
  create: (data: Partial<Skill>) =>
    apiClient.post<Skill>('/skills', data).then(r => r.data),
  update: (id: string, data: Partial<Skill>) =>
    apiClient.put<Skill>(`/skills/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    apiClient.delete(`/skills/${id}`),
  getPreloadedImports: () =>
    apiClient.get<PreloadedImports>('/skills/preloaded-imports').then(r => r.data),
  test: (id: string, testInput: Record<string, unknown>, configOverride?: Record<string, unknown>) =>
    apiClient.post<SkillTestResult>(`/skills/${id}/test`, { test_input: testInput, config_override: configOverride }).then(r => r.data),
  testCode: (data: { source_code: string; connection_mappings?: Record<string, string> | null; test_input: Record<string, unknown> }) =>
    apiClient.post<SkillTestResult>('/skills/test-code', data).then(r => r.data),
  configure: (id: string, data: { config_values?: Record<string, unknown>; bound_connection_id?: string | null }) =>
    apiClient.put<Skill>(`/skills/${id}/configure`, data).then(r => r.data),
  getTestFileUrl: (fileId: string) =>
    `${apiClient.defaults.baseURL}/skills/test-file/${fileId}`,
  uploadTestFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<{ file_id: string; filename: string; content_type: string; size: number; expires_at: string }>(
      '/skills/upload-test-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data);
  },
};

// --- Connections ---
export const connectionsApi = {
  list: (page = 1, pageSize = 50) =>
    apiClient.get<PaginatedResponse<Connection>>('/connections', { params: { page, page_size: pageSize } }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<Connection>(`/connections/${id}`).then(r => r.data),
  create: (data: Partial<Connection>) =>
    apiClient.post<Connection>('/connections', data).then(r => r.data),
  update: (id: string, data: Partial<Connection>) =>
    apiClient.put<Connection>(`/connections/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    apiClient.delete(`/connections/${id}`),
  test: (id: string) =>
    apiClient.post<ConnectionTestResult>(`/connections/${id}/test`).then(r => r.data),
  setDefault: (id: string) =>
    apiClient.put<Connection>(`/connections/${id}/set-default`).then(r => r.data),
  getDefaults: () =>
    apiClient.get<Record<string, Connection | null>>('/connections/defaults').then(r => r.data),
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
