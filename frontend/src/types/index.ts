// === Core Models ===

export interface PipelineIOInput {
  name: string;
  source: string;
  description?: string;
}

export interface PipelineIOOutput {
  name: string;
  targetName: string;
  description?: string;
}

export interface PipelineIO {
  default_context: string;
  inputs: PipelineIOInput[];
  outputs: PipelineIOOutput[];
}

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
  required_resource_types: string[] | null;
  bound_connection_id: string | null;
  config_values: Record<string, unknown> | null;
  pipeline_io: PipelineIO | null;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  name: string;
  connection_type: string;
  description: string | null;
  config: Record<string, unknown>;
  is_default: boolean;
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

export interface PipelineNode {
  id: string;
  skill_name: string;
  label: string;
  position: number;
  context: string;
  inputs: PipelineIOInput[];
  outputs: PipelineIOOutput[];
  config_overrides: Record<string, unknown>;
  bound_connection_id?: string;
  x?: number;
  y?: number;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'validated' | 'active' | 'archived';
  graph_data: {
    nodes: PipelineNode[];
    edges?: PipelineEdge[];
  };
  created_at: string;
  updated_at: string;
}

export interface NodeExecutionResult {
  node_id: string;
  skill_name: string;
  label: string;
  status: 'success' | 'error';
  execution_time_ms: number;
  records_processed: number;
  input_snapshots: Record<string, unknown>[];
  output_snapshots: Record<string, unknown>[];
  errors: Array<{ message: string; traceback?: string }>;
  warnings: string[];
}

export interface PipelineDebugResult {
  status: 'success' | 'partial' | 'error';
  total_execution_time_ms: number;
  enrichment_tree: Record<string, unknown>;
  node_results: NodeExecutionResult[];
  error?: string;
}

export interface PipelineTemplate {
  name: string;
  description: string;
  nodes: PipelineNode[];
}

export type DataSourceType =
  | 'local_upload'
  | 'azure_blob'
  | 'azure_adls_gen2'
  | 'azure_cosmos_db'
  | 'azure_sql'
  | 'azure_table'
  | 'microsoft_onelake'
  | 'sharepoint'
  | 'onedrive'
  | 'onedrive_business'
  | 'azure_file_storage'
  | 'azure_queues'
  | 'service_bus'
  | 'amazon_s3'
  | 'dropbox'
  | 'sftp_ssh';

export interface DataSource {
  id: string;
  name: string;
  description: string | null;
  source_type: DataSourceType;
  connection_config: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  file_count: number;
  total_size: number;
  pipeline_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataSourceTestResult {
  success: boolean;
  message: string;
}

export interface UploadQuotaInfo {
  total_mb: number;
  used_mb: number;
  available_mb: number;
  retention_days: number;
  max_file_size_mb: number;
  temp_dir: string;
}

export type TargetType =
  | 'azure_ai_search'
  | 'azure_blob'
  | 'cosmosdb_gremlin'
  | 'neo4j'
  | 'mysql'
  | 'postgresql';

export interface Target {
  id: string;
  name: string;
  description: string | null;
  target_type: TargetType;
  connection_config: Record<string, unknown>;
  field_mappings: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  pipeline_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TargetTestResult {
  success: boolean;
  message: string;
}

export interface TargetSchemaField {
  name: string;
  type: string;
  searchable?: boolean;
  filterable?: boolean;
  nullable?: boolean;
  key?: boolean;
  vector_config?: Record<string, unknown>;
}

export interface TargetSchemaDiscovery {
  exists: boolean;
  schema_fields: TargetSchemaField[] | null;
  suggested_schema: TargetSchemaField[] | null;
}

export interface MappingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PipelineOutputField {
  path: string;
  type: string;
  from_skill: string;
  vector_hint?: { model: string; dimensions: number };
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

// === Workflow ===

export interface FileFilter {
  extensions?: string[];
  mime_types?: string[];
  size_range?: { min_bytes?: number; max_bytes?: number };
  path_pattern?: string;
}

export interface RouteRule {
  name: string;
  priority: number;
  file_filter: FileFilter;
  pipeline_id: string;
  target_ids: string[];
}

export interface DefaultRoute {
  name: string;
  pipeline_id: string;
  target_ids: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  data_source_ids: string[];
  routes: RouteRule[];
  default_route: DefaultRoute | null;
  created_at: string;
  updated_at: string;
}

// === WorkflowRun ===

export interface PipelineRunRecord {
  id: string;
  workflow_run_id: string;
  pipeline_id: string;
  route_name: string;
  target_ids: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_files: number;
  processed_files: number;
  failed_files: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_files: number;
  processed_files: number;
  failed_files: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRunDetail extends WorkflowRun {
  pipeline_runs: PipelineRunRecord[];
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

// === Dashboard Stats ===

export interface DashboardResourceCounts {
  skills: number;
  connections: number;
  pipelines: number;
  data_sources: number;
  targets: number;
  workflows: number;
  workflow_runs: number;
  runs: number;
  agents: number;
}

export interface DashboardSkillBreakdown {
  builtin: number;
  custom: number;
}

export interface DashboardAgentBreakdown {
  available: number;
  unavailable: number;
}

export interface DashboardWorkflowRunStats {
  success_rate: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
}

export interface DashboardRecentWorkflowRun {
  id: string;
  workflow_id: string;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  started_at: string | null;
  finished_at: string | null;
}

export interface DashboardStats {
  counts: DashboardResourceCounts;
  skill_breakdown: DashboardSkillBreakdown;
  agent_breakdown: DashboardAgentBreakdown;
  workflow_run_stats: DashboardWorkflowRunStats;
  recent_workflow_runs: DashboardRecentWorkflowRun[];
}
