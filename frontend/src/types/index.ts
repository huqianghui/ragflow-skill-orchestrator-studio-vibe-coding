// === Core Models ===

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  skill_type: 'builtin' | 'web_api' | 'config_template' | 'python_code';
  config_schema: Record<string, unknown>;
  is_builtin: boolean;
  source_code: string | null;
  additional_requirements: string | null;
  test_input: Record<string, unknown> | null;
  connection_mappings: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  name: string;
  connection_type: string;
  description: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export interface SkillTestResult {
  values: Array<{
    recordId: string;
    data: Record<string, unknown>;
    errors: Array<{ message: string; traceback?: string }>;
    warnings: Array<{ message: string }>;
  }>;
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    details: Record<string, unknown> | null;
  }>;
  execution_time_ms: number;
  error?: string;
}

export interface PreloadedImports {
  standard_library: string[];
  third_party: string[];
}

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'validated' | 'active' | 'archived';
  graph_data: {
    nodes: unknown[];
    edges: unknown[];
  };
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  id: string;
  name: string;
  description: string | null;
  source_type: 'local_upload' | 'azure_blob';
  connection_config: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  file_count: number;
  total_size: number;
  pipeline_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Target {
  id: string;
  name: string;
  description: string | null;
  target_type: 'azure_ai_search' | 'mysql' | 'postgresql' | 'cosmosdb' | 'neo4j';
  connection_config: Record<string, unknown>;
  field_mappings: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  pipeline_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  pipeline_id: string;
  datasource_id: string | null;
  target_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  mode: 'sync' | 'async';
  started_at: string | null;
  finished_at: string | null;
  total_documents: number;
  processed_documents: number;
  failed_documents: number;
  error_message: string | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// === API Response Types ===

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}
