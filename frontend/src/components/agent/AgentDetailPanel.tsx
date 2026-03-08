import { useState } from 'react';
import { Divider, Space, Tag, Typography, theme } from 'antd';
import {
  ToolOutlined,
  CloudServerOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import type { AgentInfo } from '../../types/agent';
import AgentIcon from './AgentIcon';

const { Text } = Typography;

interface AgentDetailPanelProps {
  agent: AgentInfo | undefined;
}

/**
 * Right-side collapsible sidebar showing agent info, tools & MCP in one panel.
 * Only renders when an agent is selected.
 */
export default function AgentDetailPanel({ agent }: AgentDetailPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  // Not selected → don't render at all
  if (!agent) return null;

  return (
    <div style={{
      width: collapsed ? 40 : 300,
      minWidth: collapsed ? 40 : 300,
      borderLeft: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorBgLayout,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.2s, min-width 0.2s',
    }}>
      {/* Collapse toggle */}
      <div
        onClick={() => setCollapsed(prev => !prev)}
        style={{
          padding: '8px 0',
          textAlign: 'center',
          cursor: 'pointer',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          color: token.colorTextSecondary,
          fontSize: 14,
        }}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {/* Agent header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <AgentIcon name={agent.icon} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text strong style={{ fontSize: 14 }}>{agent.display_name}</Text>
              <Tag
                color={agent.available ? 'success' : 'default'}
                style={{ marginLeft: 8, fontSize: 10 }}
              >
                {agent.available ? 'ON' : 'OFF'}
              </Tag>
            </div>
          </div>

          {/* Description */}
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            {agent.description}
          </Text>
          {agent.version && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Version: {agent.version}
            </Text>
          )}
          <Space size={4} wrap style={{ marginBottom: 4 }}>
            {agent.modes.map(m => (
              <Tag key={m} style={{ fontSize: 11, margin: 0 }}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Tag>
            ))}
          </Space>

          {/* Tools */}
          {agent.tools.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0 8px' }} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              }}>
                <ToolOutlined style={{ fontSize: 13 }} />
                <Text strong style={{ fontSize: 12 }}>
                  Tools ({agent.tools.length})
                </Text>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {agent.tools.map(t => (
                  <Tag key={t} style={{ fontSize: 11, margin: 0, padding: '1px 6px' }}>
                    {t}
                  </Tag>
                ))}
              </div>
            </>
          )}

          {/* MCP Servers */}
          {agent.mcp_servers.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0 8px' }} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              }}>
                <CloudServerOutlined style={{ fontSize: 13 }} />
                <Text strong style={{ fontSize: 12 }}>
                  MCP Servers ({agent.mcp_servers.length})
                </Text>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {agent.mcp_servers.map(s => (
                  <Tag
                    key={s}
                    color="purple"
                    style={{ fontSize: 11, margin: 0, padding: '1px 6px' }}
                  >
                    {s}
                  </Tag>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
