import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import type { AgentInfo } from '../types/agent';
import { agentApi } from '../services/agentApi';
import AgentChatWidget from '../components/agent/AgentChatWidget';
import AgentSelector from '../components/agent/AgentSelector';

export default function AgentPlayground() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedMode, setSelectedMode] = useState('ask');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    searchParams.get('session'),
  );
  const [chatKey, setChatKey] = useState(0);

  // Clear session query param after reading
  useEffect(() => {
    if (searchParams.has('session')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Load agents
  useEffect(() => {
    agentApi.getAvailable().then((list) => {
      setAgents(list);
      const firstAvailable = list.find(a => a.available);
      if (firstAvailable) {
        setSelectedAgent(firstAvailable.name);
        const preferredMode = firstAvailable.modes.includes('ask')
          ? 'ask' : firstAvailable.modes[0] || 'code';
        setSelectedMode(preferredMode);
      }
    }).catch(() => {
      message.error('Failed to load agents');
    });
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
          onAgentChange={setSelectedAgent}
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
