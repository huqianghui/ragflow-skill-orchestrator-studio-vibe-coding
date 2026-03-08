// === Agent Module Types ===

import type { PipelineNode } from './index';

/** Agent info from GET /agents/available */
export interface AgentInfo {
  name: string;
  display_name: string;
  icon: string;
  description: string;
  modes: string[];
  available: boolean;
  version: string | null;
  provider: string | null;
  model: string | null;
  install_hint: string | null;
  tools: string[];
  mcp_servers: string[];
}

/** Session record from backend */
export interface AgentSession {
  id: string;
  agent_name: string;
  native_session_id: string | null;
  title: string;
  mode: string;
  source: string;
  created_at: string;
  updated_at: string;
}

/** WebSocket client → server message */
export interface AgentChatMessage {
  type: 'message';
  content: string;
  mode: string;
  context?: AgentContextData | null;
}

export interface AgentContextData {
  type: 'skill' | 'pipeline' | 'free';
  skill?: Record<string, unknown>;
  pipeline?: Record<string, unknown>;
  selected_node?: string;
  error_result?: Record<string, unknown>;
  attachments?: Attachment[];
}

export interface Attachment {
  type: 'skill' | 'pipeline' | 'text';
  label: string;
  content: string;
}

/** Server → client event via WebSocket */
export interface AgentEvent {
  type: 'text' | 'code' | 'error' | 'session_init' | 'done';
  content: string;
  metadata: Record<string, unknown>;
}

/** Internal chat message for UI rendering */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** Pipeline action suggested by agent */
export type PipelineAction =
  | { action: 'add_node'; skill_name: string; position: number; config_overrides?: Record<string, unknown> }
  | { action: 'remove_node'; node_id: string }
  | { action: 'update_node'; node_id: string; changes: Partial<PipelineNode> }
  | { action: 'update_config'; node_id: string; config_overrides: Record<string, unknown> };
