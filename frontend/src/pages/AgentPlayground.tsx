import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import type { AgentInfo } from '../types/agent';
import { agentApi } from '../services/agentApi';
import AgentChatWidget from '../components/agent/AgentChatWidget';
import AgentSelector from '../components/agent/AgentSelector';

const THIRTY_MINUTES = 30 * 60 * 1000;

export default function AgentPlayground() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedMode, setSelectedMode] = useState('ask');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const agentsRef = useRef<AgentInfo[]>([]);

  // Read params from URL (set by AgentHistory navigation)
  const urlAgent = searchParams.get('agent');
  const urlSession = searchParams.get('session');

  // Clear query params after reading
  useEffect(() => {
    if (searchParams.has('session') || searchParams.has('agent')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /**
   * Try to find and restore the most recent playground session for an agent.
   * Returns true if a recent session (< 30 min) was found and restored.
   */
  const tryRestoreRecentSession = useCallback(
    async (agentName: string, preferredMode: string): Promise<boolean> => {
      try {
        const result = await agentApi.listSessions({
          agent_name: agentName,
          source: 'playground',
          page_size: 1,
        });
        const latest = result.items[0];
        if (latest) {
          const updatedAt = new Date(latest.updated_at + 'Z').getTime();
          if (Date.now() - updatedAt < THIRTY_MINUTES) {
            setCurrentSessionId(latest.id);
            setSelectedMode(latest.mode || preferredMode);
            return true;
          }
        }
      } catch {
        // Query failure should not block UX
      }
      return false;
    },
    [],
  );

  /**
   * Handle agent switch: set agent, determine preferred mode,
   * then try to restore the most recent playground session (< 30 min).
   */
  const handleAgentChange = useCallback(
    async (agentName: string) => {
      setSelectedAgent(agentName);
      const agent = agentsRef.current.find((a) => a.name === agentName);
      const preferredMode = agent?.modes.includes('ask')
        ? 'ask'
        : agent?.modes[0] || 'code';
      setSelectedMode(preferredMode);

      const restored = await tryRestoreRecentSession(agentName, preferredMode);
      if (!restored) {
        setCurrentSessionId(null);
        setChatKey((prev) => prev + 1);
      }
    },
    [tryRestoreRecentSession],
  );

  // Load agents and handle URL navigation (session restore from History)
  useEffect(() => {
    const init = async () => {
      try {
        const list = await agentApi.getAvailable();
        setAgents(list);
        agentsRef.current = list;

        // If coming from History with a session, fetch session details
        if (urlSession) {
          try {
            const session = await agentApi.getSession(urlSession);
            const sessionAgent = list.find(
              (a) => a.name === session.agent_name && a.available,
            );
            if (sessionAgent) {
              setSelectedAgent(sessionAgent.name);
              setSelectedMode(session.mode || 'ask');
              setCurrentSessionId(urlSession);
              return;
            }
          } catch {
            message.warning('Failed to load session details');
          }
        }

        // Fallback: use urlAgent param or pick first available
        const urlTarget = urlAgent
          ? list.find((a) => a.name === urlAgent && a.available)
          : null;
        const target = urlTarget || list.find((a) => a.available);

        if (target) {
          // Try restoring recent session for the initial agent
          setSelectedAgent(target.name);
          const preferredMode = target.modes.includes('ask')
            ? 'ask'
            : target.modes[0] || 'code';
          setSelectedMode(preferredMode);
          await tryRestoreRecentSession(target.name, preferredMode);
        }
      } catch {
        message.error('Failed to load agents');
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvoke = () => {
    setCurrentSessionId(null);
    setChatKey(prev => prev + 1);
  };

  const handleSessionCreated = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  return (
    <div style={{
      height: 'calc(100vh - 112px)',
      display: 'flex',
      gap: 16,
    }}>
      {/* Left panel: Agent list + Invoke button */}
      <div style={{
        width: 250,
        flexShrink: 0,
        borderRight: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        paddingRight: 12,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <AgentSelector
          agents={agents}
          selectedAgent={selectedAgent}
          selectedMode={selectedMode}
          onAgentChange={handleAgentChange}
          onModeChange={setSelectedMode}
          onInvoke={handleInvoke}
        />
      </div>

      {/* Right panel: Mode bar + Detail + Chat */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <AgentChatWidget
          key={chatKey}
          embedded={false}
          agentName={selectedAgent}
          agentMode={selectedMode}
          onModeChange={setSelectedMode}
          agents={agents}
          sessionId={currentSessionId ?? undefined}
          onSessionCreated={handleSessionCreated}
        />
      </div>
    </div>
  );
}
