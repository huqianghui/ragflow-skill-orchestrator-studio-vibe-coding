import apiClient from './api';
import type { PaginatedResponse } from '../types';
import type { AgentInfo, AgentSession, AgentChatMessage, AgentEvent } from '../types/agent';

// --- REST API ---

export const agentApi = {
  getAvailable: () =>
    apiClient.get<AgentInfo[]>('/agents/available').then(r => r.data),

  getConfig: (agentName: string) =>
    apiClient.get<Record<string, unknown>>(`/agents/${agentName}/config`).then(r => r.data),

  createSession: (agentName: string, source: string, mode: string) =>
    apiClient.post<AgentSession>('/agents/sessions', {
      agent_name: agentName, source, mode,
    }).then(r => r.data),

  listSessions: (params: { source?: string; agent_name?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<AgentSession>>('/agents/sessions', { params }).then(r => r.data),

  getSession: (id: string) =>
    apiClient.get<AgentSession>(`/agents/sessions/${id}`).then(r => r.data),

  deleteSession: (id: string) =>
    apiClient.delete(`/agents/sessions/${id}`),

  getSessionMessages: (id: string) =>
    apiClient.get<{ id: string; role: string; content: string; created_at: string }[]>(
      `/agents/sessions/${id}/messages`,
    ).then(r => r.data),
};

// --- WebSocket ---

export class AgentWebSocket {
  private ws: WebSocket | null = null;
  private eventCallback: ((event: AgentEvent) => void) | null = null;
  private errorCallback: ((error: Event) => void) | null = null;
  private closeCallback: (() => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private lastSessionId: string | null = null;
  private intentionalClose = false;

  connect(sessionId: string): void {
    this.lastSessionId = sessionId;
    this.intentionalClose = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = `${protocol}//${window.location.host}/api/v1`;
    this.ws = new WebSocket(`${base}/agents/sessions/${sessionId}/ws`);

    this.ws.onmessage = (evt) => {
      const event: AgentEvent = JSON.parse(evt.data);
      this.eventCallback?.(event);
    };

    this.ws.onerror = (evt) => {
      this.errorCallback?.(evt);
    };

    this.ws.onclose = () => {
      if (!this.intentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          if (this.lastSessionId) this.connect(this.lastSessionId);
        }, 1000 * this.reconnectAttempts);
      } else {
        this.closeCallback?.();
      }
    };

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };
  }

  send(message: AgentChatMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  onEvent(callback: (event: AgentEvent) => void): void {
    this.eventCallback = callback;
  }

  onError(callback: (error: Event) => void): void {
    this.errorCallback = callback;
  }

  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
