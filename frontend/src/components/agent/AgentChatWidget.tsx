import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, message, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import type {
  AgentInfo, Attachment, AgentContextData, ChatMessage, PipelineAction,
} from '../../types/agent';
import { agentApi, AgentWebSocket } from '../../services/agentApi';
import AgentDetailPanel from './AgentDetailPanel';
import ModeBar from './ModeBar';
import ContextPanel from './ContextPanel';
import MessageBubble from './MessageBubble';

const { Text } = Typography;

interface AgentChatWidgetProps {
  embedded?: boolean;
  agentName?: string;
  agentMode?: string;
  onModeChange?: (mode: string) => void;
  agents?: AgentInfo[];
  autoContext?: {
    type: 'skill' | 'pipeline';
    data: Record<string, unknown>;
    selectedNode?: string;
    errorResult?: Record<string, unknown>;
  };
  onApplyCode?: (code: string) => void;
  onApplyConfig?: (config: Record<string, unknown>) => void;
  onApplyPipelineAction?: (action: PipelineAction) => void;
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
}

export default function AgentChatWidget({
  embedded = true,
  agentName: externalAgentName,
  agentMode: externalAgentMode,
  onModeChange: externalOnModeChange,
  agents: externalAgents,
  autoContext,
  onApplyCode,
  onApplyConfig,
  onApplyPipelineAction,
  sessionId,
  onSessionCreated,
}: AgentChatWidgetProps) {
  const [internalAgents, setInternalAgents] = useState<AgentInfo[]>([]);
  const [internalAgent, setInternalAgent] = useState('');
  const [internalMode, setInternalMode] = useState('ask');

  const agents = externalAgents ?? internalAgents;
  const selectedAgent = externalAgentName ?? internalAgent;
  const selectedMode = externalAgentMode ?? internalMode;
  const currentAgentInfo = agents.find(a => a.name === selectedAgent);
  const allModes = currentAgentInfo?.modes ?? [];
  const modes = embedded ? allModes.filter(m => m !== 'plan') : allModes;

  const handleModeChange = (mode: string) => {
    if (externalOnModeChange) externalOnModeChange(mode);
    else setInternalMode(mode);
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const wsRef = useRef(new AgentWebSocket());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantContentRef = useRef('');
  const streamingRef = useRef(false);
  // Stable ID for the current assistant bubble during streaming
  const streamMsgIdRef = useRef('');

  // Load agents only in embedded mode
  useEffect(() => {
    if (!embedded) return;
    agentApi.getAvailable().then((list) => {
      setInternalAgents(list);
      const firstAvailable = list.find(a => a.available);
      if (firstAvailable) {
        setInternalAgent(firstAvailable.name);
        const preferredMode = firstAvailable.modes.includes('ask')
          ? 'ask' : firstAvailable.modes[0] || 'code';
        setInternalMode(preferredMode);
      }
    }).catch(() => {
      message.error('Failed to load agents');
    });
  }, [embedded]);

  // Setup WebSocket event handler
  useEffect(() => {
    const ws = wsRef.current;
    ws.onEvent((event) => {
      if (event.type === 'done') {
        streamingRef.current = false;
        setStreaming(false);
        assistantContentRef.current = '';
        streamMsgIdRef.current = '';
        return;
      }
      if (event.type === 'error') {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `**Error:** ${event.content}`,
          timestamp: Date.now(),
        }]);
        streamingRef.current = false;
        setStreaming(false);
        assistantContentRef.current = '';
        streamMsgIdRef.current = '';
        return;
      }
      // Skip non-text events (session_init, system, etc.)
      if (!event.content) return;

      // Accumulate text chunk
      assistantContentRef.current += event.content;
      const currentContent = assistantContentRef.current;
      const stableId = streamMsgIdRef.current;

      setMessages(prev => {
        // Find the streaming bubble by its stable ID
        const idx = prev.findIndex(m => m.id === stableId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], content: currentContent };
          return updated;
        }
        // Shouldn't reach here, but safety fallback
        return [...prev, {
          id: stableId,
          role: 'assistant',
          content: currentContent,
          timestamp: Date.now(),
        }];
      });
    });
    ws.onError(() => {
      message.error('WebSocket connection error');
      streamingRef.current = false;
      setStreaming(false);
    });
    return () => { ws.disconnect(); };
  }, []);

  // Reset session when agent changes
  const prevAgentRef = useRef(selectedAgent);
  useEffect(() => {
    if (prevAgentRef.current && prevAgentRef.current !== selectedAgent) {
      wsRef.current.disconnect();
      setMessages([]);
      setCurrentSessionId(null);
      assistantContentRef.current = '';
      streamingRef.current = false;
      setStreaming(false);
    }
    prevAgentRef.current = selectedAgent;
  }, [selectedAgent]);

  // Playground mode: handle sessionId changes (e.g. from History navigation)
  useEffect(() => {
    if (!embedded) {
      if (sessionId && sessionId !== currentSessionId) {
        wsRef.current.disconnect();
        setCurrentSessionId(sessionId);
        // Load persisted messages from DB
        agentApi.getSessionMessages(sessionId).then((msgs) => {
          const loaded: ChatMessage[] = msgs.map((m, idx) => ({
            id: `history-${m.id || idx}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.created_at ? new Date(m.created_at + 'Z').getTime() : Date.now(),
          }));
          if (loaded.length > 0) {
            setMessages(loaded);
          } else {
            setMessages([{
              id: `system-resume-${Date.now()}`,
              role: 'assistant',
              content: '**Session resumed** — send a message to continue the conversation.',
              timestamp: Date.now(),
            }]);
          }
        }).catch(() => {
          setMessages([{
            id: `system-resume-${Date.now()}`,
            role: 'assistant',
            content: '**Session resumed** — send a message to continue the conversation.',
            timestamp: Date.now(),
          }]);
        });
      }
      if (!sessionId && currentSessionId) {
        wsRef.current.disconnect();
        setMessages([]);
        setCurrentSessionId(null);
      }
    }
  }, [sessionId, embedded, currentSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const buildContext = useCallback((): AgentContextData | null => {
    if (autoContext) {
      return {
        type: autoContext.type,
        skill: autoContext.type === 'skill' ? autoContext.data : undefined,
        pipeline: autoContext.type === 'pipeline' ? autoContext.data : undefined,
        selected_node: autoContext.selectedNode,
        error_result: autoContext.errorResult,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
    }
    if (attachments.length > 0) {
      return { type: 'free', attachments };
    }
    return null;
  }, [autoContext, attachments]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || streaming) return;
    if (!selectedAgent) {
      message.warning('Please select an agent');
      return;
    }

    // 1. Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }]);

    // 2. Add empty assistant bubble (streaming placeholder)
    const assistantMsgId = `assistant-${Date.now()}`;
    streamMsgIdRef.current = assistantMsgId;
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }]);

    setInputValue('');
    streamingRef.current = true;
    setStreaming(true);
    assistantContentRef.current = '';

    const source = embedded
      ? (autoContext?.type === 'pipeline' ? 'pipeline-editor' : 'skill-editor')
      : 'playground';

    let sid = embedded ? currentSessionId : (sessionId ?? currentSessionId);

    if (!sid) {
      try {
        const session = await agentApi.createSession(selectedAgent, source, selectedMode);
        sid = session.id;
        setCurrentSessionId(session.id);
        if (!embedded) onSessionCreated?.(session.id);
      } catch {
        message.error('Failed to create session');
        setStreaming(false);
        return;
      }
    }

    if (!wsRef.current.connected) {
      wsRef.current.connect(sid);
      const waitForOpen = () => new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WS timeout')), 5000);
        const check = setInterval(() => {
          if (wsRef.current.connected) {
            clearTimeout(timeout);
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
      try {
        await waitForOpen();
      } catch {
        message.error('WebSocket connection timeout');
        setStreaming(false);
        return;
      }
    }

    wsRef.current.send({
      type: 'message',
      content: text,
      mode: selectedMode,
      context: buildContext(),
    });
  };

  const handleApplyCode = useCallback((code: string) => {
    if (onApplyCode) {
      onApplyCode(code);
      message.success('Applied to editor');
    } else if (onApplyConfig) {
      try {
        const config = JSON.parse(code);
        onApplyConfig(config);
        message.success('Applied config');
      } catch {
        message.error('Invalid JSON for config');
      }
    }
  }, [onApplyCode, onApplyConfig]);

  const noAvailableAgents = agents.length > 0 && agents.every(a => !a.available);
  const showApply = embedded && !!(onApplyCode || onApplyConfig || onApplyPipelineAction);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Main chat column */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
      }}>

        {/* Mode bar (hidden when only one mode available) */}
        {modes.length > 1 && (
          <ModeBar
            modes={modes}
            selectedMode={selectedMode}
            onModeChange={handleModeChange}
          />
        )}

        {/* Context panel */}
        <ContextPanel
          autoContext={autoContext}
          attachments={attachments}
          onAddAttachment={() => {}}
          onRemoveAttachment={(idx) => setAttachments(prev => prev.filter((_, i) => i !== idx))}
          compact={embedded}
        />

        {/* Messages */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '8px 0',
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {noAvailableAgents
                  ? 'No available agents detected'
                  : 'Start a conversation with the agent'}
              </Text>
            </div>
          )}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              showApply={showApply}
              onApplyCode={handleApplyCode}
              streaming={streaming && msg.id === streamMsgIdRef.current}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '8px 0',
          borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        }}>
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            autoSize={{ minRows: embedded ? 2 : 3, maxRows: 6 }}
            disabled={streaming || noAvailableAgents}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={streaming}
              disabled={!inputValue.trim() || noAvailableAgents}
              size={embedded ? 'small' : 'middle'}
            >
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Right sidebar: Agent Info & Tools (Playground only) */}
      {!embedded && <AgentDetailPanel agent={currentAgentInfo} />}
    </div>
  );
}
