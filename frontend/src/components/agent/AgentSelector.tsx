import { Button, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined, ToolOutlined, CloudServerOutlined } from '@ant-design/icons';
import type { AgentInfo } from '../../types/agent';
import AgentIcon from './AgentIcon';

const { Text } = Typography;

interface AgentSelectorProps {
  agents: AgentInfo[];
  selectedAgent: string;
  selectedMode: string;
  onAgentChange: (name: string) => void;
  onModeChange: (mode: string) => void;
  onInvoke?: () => void;
  compact?: boolean;
}

/** Vertical agent card list for Playground left panel. */
export default function AgentSelector({
  agents, selectedAgent, onAgentChange, onModeChange, onInvoke, compact,
}: AgentSelectorProps) {
  // Compact mode: Select-based UI for embedded (skill/pipeline editor) usage
  if (compact) {
    const currentAgent = agents.find(a => a.name === selectedAgent);
    const modes = currentAgent?.modes ?? [];
    return (
      <div style={{ marginBottom: 8 }}>
        <Space size={8} wrap>
          <Select
            value={selectedAgent}
            onChange={(val: string) => {
              onAgentChange(val);
              const agent = agents.find(a => a.name === val);
              if (agent && agent.modes.length > 0) {
                const preferredMode = agent.modes.includes('ask') ? 'ask' : agent.modes[0];
                onModeChange(preferredMode);
              }
            }}
            style={{ minWidth: 140 }}
            size="small"
            options={agents.map(a => ({
              value: a.name,
              label: (
                <Space size={4}>
                  <span>{a.display_name}</span>
                  <Tag
                    color={a.available ? 'success' : 'default'}
                    style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                  >
                    {a.available ? 'ON' : 'OFF'}
                  </Tag>
                </Space>
              ),
              disabled: !a.available,
            }))}
          />
          <Select
            value={modes[0] || ''}
            onChange={onModeChange}
            style={{ minWidth: 90 }}
            size="small"
            options={modes.map(m => ({
              value: m,
              label: m.charAt(0).toUpperCase() + m.slice(1),
            }))}
          />
        </Space>
      </div>
    );
  }

  // Full panel mode: vertical card list
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Agent cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
        <Text
          type="secondary"
          style={{ fontSize: 11, display: 'block', marginBottom: 8, letterSpacing: 1 }}
        >
          AGENTS
        </Text>
        {agents.map(agent => {
          const isSelected = agent.name === selectedAgent;
          return (
            <div
              key={agent.name}
              onClick={() => {
                if (!agent.available) return;
                onAgentChange(agent.name);
                const preferredMode = agent.modes.includes('ask')
                  ? 'ask' : agent.modes[0];
                if (preferredMode) onModeChange(preferredMode);
              }}
              style={{
                padding: '10px 12px',
                marginBottom: 6,
                borderRadius: 8,
                border: isSelected
                  ? '2px solid var(--ant-color-primary, #1677ff)'
                  : '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                cursor: agent.available ? 'pointer' : 'not-allowed',
                opacity: agent.available ? 1 : 0.45,
                background: isSelected
                  ? 'var(--ant-color-primary-bg, #e6f4ff)'
                  : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {/* Header: icon + name + ON/OFF */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
              }}>
                <AgentIcon name={agent.icon} size={22} />
                <Text strong style={{ fontSize: 13, flex: 1 }}>
                  {agent.display_name}
                </Text>
                <Tag
                  color={agent.available ? 'success' : 'default'}
                  style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                >
                  {agent.available ? 'ON' : 'OFF'}
                </Tag>
              </div>
              <Text
                type="secondary"
                style={{ fontSize: 11, display: 'block', lineHeight: '16px' }}
              >
                {agent.description}
              </Text>
              {agent.version && (
                <Text type="secondary" style={{ fontSize: 10 }}>
                  v{agent.version}
                </Text>
              )}
              {/* Tools & MCP mini summary */}
              {agent.available
                && (agent.tools.length > 0 || agent.mcp_servers.length > 0) && (
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {agent.tools.length > 0 && (
                    <Tooltip title={agent.tools.join(', ')}>
                      <Tag
                        icon={<ToolOutlined />}
                        style={{ fontSize: 10, margin: 0, cursor: 'help' }}
                      >
                        {agent.tools.length} tools
                      </Tag>
                    </Tooltip>
                  )}
                  {agent.mcp_servers.length > 0 && (
                    <Tooltip title={agent.mcp_servers.join(', ')}>
                      <Tag
                        icon={<CloudServerOutlined />}
                        color="purple"
                        style={{ fontSize: 10, margin: 0, cursor: 'help' }}
                      >
                        {agent.mcp_servers.length} MCP
                      </Tag>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invoke button at bottom */}
      {onInvoke && (
        <div style={{
          borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          paddingTop: 12,
          marginTop: 8,
        }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={onInvoke}
          >
            Invoke New Session
          </Button>
        </div>
      )}
    </div>
  );
}
