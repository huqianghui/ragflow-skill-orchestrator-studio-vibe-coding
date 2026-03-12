import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, message, Tag, Typography } from 'antd';
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

/** Max seconds to wait for any streaming data before auto-resetting. */
const STREAMING_TIMEOUT_MS = 120_000;

interface QueuedMessage {
  text: string;
  timestamp: number;
}

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
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const wsRef = useRef(new AgentWebSocket());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantContentRef = useRef('');
  const streamingRef = useRef(false);
  // Stable ID for the current assistant bubble during streaming
  const streamMsgIdRef = useRef('');
  // Streaming watchdog timer
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Streaming safety: reset streaming state with cleanup
  // ---------------------------------------------------------------------------
  const resetStreaming = useCallback(() => {
    streamingRef.current = false;
    setStreaming(false);
    assistantContentRef.current = '';
    streamMsgIdRef.current = '';
    if (streamingTimerRef.current) {
      clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
  }, []);

  /** Restart the watchdog timer — called on every incoming streaming event. */
  const resetStreamingWatchdog = useCallback(() => {
    if (streamingTimerRef.current) clearTimeout(streamingTimerRef.current);
    streamingTimerRef.current = setTimeout(() => {
      if (streamingRef.current) {
        resetStreaming();
        message.warning('Agent response timed out');
      }
    }, STREAMING_TIMEOUT_MS);
  }, [resetStreaming]);

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
        resetStreaming();
        return;
      }
      if (event.type === 'error') {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `**Error:** ${event.content}`,
          timestamp: Date.now(),
        }]);
        resetStreaming();
        return;
      }
      // Skip non-text events (session_init, system, etc.)
      if (!event.content) return;

      // Reset watchdog on every data chunk
      resetStreamingWatchdog();

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
      resetStreaming();
    });
    // Register onClose to reset streaming when WS closes after reconnect exhaustion
    ws.onClose(() => {
      if (streamingRef.current) {
        resetStreaming();
      }
    });
    return () => {
      ws.disconnect();
      if (streamingTimerRef.current) clearTimeout(streamingTimerRef.current);
    };
  }, [resetStreaming, resetStreamingWatchdog]);

  // Reset session when agent changes
  const prevAgentRef = useRef(selectedAgent);
  useEffect(() => {
    if (prevAgentRef.current && prevAgentRef.current !== selectedAgent) {
      wsRef.current.disconnect();
      setMessages([]);
      setCurrentSessionId(null);
      resetStreaming();
      setMessageQueue([]);
      setQueueIndex(-1);
    }
    prevAgentRef.current = selectedAgent;
  }, [selectedAgent, resetStreaming]);

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

  // ---------------------------------------------------------------------------
  // Core send logic — shared by direct send and queue drain
  // ---------------------------------------------------------------------------
  const doSend = useCallback(async (text: string) => {
    if (!selectedAgent) return;

    // Add user message bubble
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }]);

    // Add empty assistant bubble (streaming placeholder)
    const assistantMsgId = `assistant-${Date.now()}`;
    streamMsgIdRef.current = assistantMsgId;
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }]);

    streamingRef.current = true;
    setStreaming(true);
    assistantContentRef.current = '';
    resetStreamingWatchdog();

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
        resetStreaming();
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
        resetStreaming();
        return;
      }
    }

    wsRef.current.send({
      type: 'message',
      content: text,
      mode: selectedMode,
      context: buildContext(),
    });
  }, [
    selectedAgent, selectedMode, embedded, autoContext, currentSessionId,
    sessionId, onSessionCreated, buildContext, resetStreaming, resetStreamingWatchdog,
  ]);

  // ---------------------------------------------------------------------------
  // Queue drain: when streaming stops, auto-send the next queued message
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!streaming && messageQueue.length > 0) {
      const [next, ...rest] = messageQueue;
      setMessageQueue(rest);
      setQueueIndex(-1);
      doSend(next.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming]);

  // ---------------------------------------------------------------------------
  // handleSend: either send directly or enqueue
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    if (!selectedAgent) {
      message.warning('Please select an agent');
      return;
    }

    setInputValue('');
    setQueueIndex(-1);

    if (streaming) {
      // Enqueue: add to message queue, show as pending in chat
      setMessageQueue(prev => [...prev, { text, timestamp: Date.now() }]);
    } else {
      // Send directly
      doSend(text);
    }
  }, [inputValue, selectedAgent, streaming, doSend]);

  // ---------------------------------------------------------------------------
  // Arrow key navigation for queued messages
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift = send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Arrow Up/Down only when cursor is at start/end and queue is non-empty
    if (messageQueue.length === 0) return;

    const textarea = e.currentTarget;
    const atStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
    const atEnd = textarea.selectionStart === textarea.value.length;

    if (e.key === 'ArrowUp' && atStart) {
      e.preventDefault();
      const newIdx = queueIndex < messageQueue.length - 1 ? queueIndex + 1 : queueIndex;
      setQueueIndex(newIdx);
      setInputValue(messageQueue[messageQueue.length - 1 - newIdx].text);
    } else if (e.key === 'ArrowDown' && atEnd) {
      e.preventDefault();
      if (queueIndex > 0) {
        const newIdx = queueIndex - 1;
        setQueueIndex(newIdx);
        setInputValue(messageQueue[messageQueue.length - 1 - newIdx].text);
      } else if (queueIndex === 0) {
        setQueueIndex(-1);
        setInputValue('');
      }
    }
  }, [handleSend, messageQueue, queueIndex]);

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

        {/* Queued messages indicator */}
        {messageQueue.length > 0 && (
          <div style={{
            padding: '4px 0',
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Queued:</Text>
            {messageQueue.map((q, i) => (
              <Tag
                key={q.timestamp}
                closable
                onClose={() => setMessageQueue(prev => prev.filter((_, idx) => idx !== i))}
                style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {q.text.length > 30 ? q.text.slice(0, 30) + '...' : q.text}
              </Tag>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: '8px 0',
          borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        }}>
          <Input.TextArea
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setQueueIndex(-1); }}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? 'Type to queue next message...' : 'Type your message...'}
            autoSize={{ minRows: embedded ? 2 : 3, maxRows: 6 }}
            disabled={noAvailableAgents}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 8, alignItems: 'center' }}>
            {streaming && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {messageQueue.length > 0
                  ? `${messageQueue.length} queued`
                  : 'Agent responding...'}
              </Text>
            )}
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={streaming && messageQueue.length === 0 && !inputValue.trim()}
              disabled={!inputValue.trim() || noAvailableAgents}
              size={embedded ? 'small' : 'middle'}
            >
              {streaming ? 'Queue' : 'Send'}
            </Button>
          </div>
        </div>
      </div>

      {/* Right sidebar: Agent Info & Tools (Playground only) */}
      {!embedded && <AgentDetailPanel agent={currentAgentInfo} />}
    </div>
  );
}
