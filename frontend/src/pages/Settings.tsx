import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Collapse, Descriptions, Modal, Progress, Space, Spin,
  Table, Tag, Typography, message, theme,
} from 'antd';
import {
  CloudUploadOutlined, PlusOutlined, ReloadOutlined,
  RobotOutlined, SettingOutlined,
} from '@ant-design/icons';
import type { UploadQuotaInfo } from '../types';
import type { AgentInfo } from '../types/agent';
import { dataSourcesApi } from '../services/api';
import { agentApi } from '../services/agentApi';
import AgentIcon from '../components/agent/AgentIcon';

const { Title, Text, Paragraph } = Typography;

/**
 * Community coding agents from the OpenSpec ecosystem.
 * Reference: https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md
 */
const COMMUNITY_AGENTS = [
  {
    name: 'claude-code',
    display_name: 'Claude Code',
    provider: 'Anthropic',
    icon: 'claude-code',
    install: 'npm install -g @anthropic-ai/claude-code',
    description: 'Anthropic official CLI coding agent with Plan/Ask/Code modes.',
  },
  {
    name: 'codex',
    display_name: 'Codex',
    provider: 'OpenAI',
    icon: 'codex',
    install: 'npm install -g @openai/codex',
    description: 'OpenAI Codex CLI coding agent with Ask/Code modes.',
  },
  {
    name: 'github-copilot',
    display_name: 'GitHub Copilot',
    provider: 'GitHub / Microsoft',
    icon: 'copilot',
    install: 'gh extension install github/gh-copilot',
    description: 'GitHub Copilot CLI and IDE coding agent.',
  },
  {
    name: 'gemini',
    display_name: 'Gemini CLI',
    provider: 'Google',
    icon: 'gemini',
    install: 'npm install -g @anthropic-ai/gemini-cli',
    description: 'Google Gemini CLI coding agent.',
  },
  {
    name: 'amazon-q',
    display_name: 'Amazon Q Developer',
    provider: 'AWS',
    icon: 'amazon-q',
    install: 'brew install amazon-q',
    description: 'AWS AI coding assistant for building on AWS.',
  },
  {
    name: 'cursor',
    display_name: 'Cursor',
    provider: 'Cursor',
    icon: 'cursor',
    install: 'Download from https://cursor.com',
    description: 'AI-first code editor with built-in agent mode.',
  },
  {
    name: 'windsurf',
    display_name: 'Windsurf',
    provider: 'Codeium',
    icon: 'windsurf',
    install: 'Download from https://windsurf.com',
    description: 'Codeium AI-powered IDE with agentic coding workflows.',
  },
  {
    name: 'cline',
    display_name: 'Cline',
    provider: 'Open Source',
    icon: 'cline',
    install: 'VS Code Extension: saoudrizwan.claude-dev',
    description: 'Autonomous coding agent in VS Code, supports multiple LLM providers.',
  },
  {
    name: 'continue',
    display_name: 'Continue',
    provider: 'Open Source',
    icon: 'continue',
    install: 'VS Code Extension: continue.continue',
    description: 'Open-source AI code assistant for VS Code and JetBrains.',
  },
  {
    name: 'roocode',
    display_name: 'RooCode',
    provider: 'Open Source',
    icon: 'roocode',
    install: 'VS Code Extension: rooveterinaryinc.roo-cline',
    description: 'AI coding agent for VS Code with multi-model support.',
  },
  {
    name: 'kilocode',
    display_name: 'Kilo Code',
    provider: 'Open Source',
    icon: 'kilocode',
    install: 'VS Code Extension: kilocode.kilocode',
    description: 'Lightweight AI coding assistant for VS Code.',
  },
  {
    name: 'kiro',
    display_name: 'Kiro',
    provider: 'AWS',
    icon: 'kiro',
    install: 'Download from https://kiro.dev',
    description: 'AWS spec-driven AI IDE for building production-ready apps.',
  },
  {
    name: 'trae',
    display_name: 'Trae',
    provider: 'ByteDance',
    icon: 'trae',
    install: 'Download from https://trae.ai',
    description: 'ByteDance AI-powered IDE with agentic coding capabilities.',
  },
  {
    name: 'auggie',
    display_name: 'Auggie (Augment Code)',
    provider: 'Augment',
    icon: 'auggie',
    install: 'VS Code Extension: augmentcode.augment',
    description: 'AI coding assistant with deep codebase understanding.',
  },
  {
    name: 'qwen',
    display_name: 'Qwen Code',
    provider: 'Alibaba',
    icon: 'qwen',
    install: 'npm install -g qwen-code',
    description: 'Alibaba Qwen-based CLI coding agent.',
  },
  {
    name: 'antigravity',
    display_name: 'Antigravity',
    provider: 'Open Source',
    icon: 'default',
    install: 'Visit https://antigravity.dev',
    description: 'AI coding agent with workspace-aware skills.',
  },
  {
    name: 'codebuddy',
    display_name: 'CodeBuddy',
    provider: 'Open Source',
    icon: 'default',
    install: 'Visit https://codebuddy.dev',
    description: 'AI pair programmer with CLI and IDE integration.',
  },
  {
    name: 'costrict',
    display_name: 'CoStrict',
    provider: 'Open Source',
    icon: 'default',
    install: 'Visit https://costrict.dev',
    description: 'Structured AI coding agent with spec-driven workflows.',
  },
  {
    name: 'crush',
    display_name: 'Crush',
    provider: 'Open Source',
    icon: 'default',
    install: 'Visit https://crush.dev',
    description: 'AI coding agent with automated code generation.',
  },
  {
    name: 'factory',
    display_name: 'Factory Droid',
    provider: 'Factory',
    icon: 'default',
    install: 'Visit https://factory.ai',
    description: 'Factory autonomous coding agent for enterprise workflows.',
  },
  {
    name: 'iflow',
    display_name: 'iFlow',
    provider: 'Open Source',
    icon: 'default',
    install: 'Visit https://iflow.dev',
    description: 'Flow-based AI coding agent.',
  },
  {
    name: 'opencode',
    display_name: 'OpenCode',
    provider: 'Open Source',
    icon: 'default',
    install: 'Visit https://opencode.dev',
    description: 'Open-source CLI coding agent.',
  },
  {
    name: 'pi',
    display_name: 'Pi',
    provider: 'Open Source',
    icon: 'default',
    install: 'Visit https://pi.dev',
    description: 'Lightweight AI coding assistant.',
  },
  {
    name: 'qoder',
    display_name: 'Qoder',
    provider: 'Open Source',
    icon: 'default',
    install: 'Visit https://qoder.dev',
    description: 'AI coding agent with quality-focused generation.',
  },
  {
    name: 'aider',
    display_name: 'Aider',
    provider: 'Open Source',
    icon: 'default',
    install: 'pip install aider-chat',
    description: 'AI pair programming in terminal. Supports multiple LLM providers.',
  },
];

function quotaColor(percent: number): string {
  if (percent > 90) return '#ff4d4f';
  if (percent > 70) return '#faad14';
  return '#52c41a';
}

/** Render a config value — recurse into objects, show strings/numbers inline. */
function ConfigValue({ value }: { value: unknown }) {
  const { token } = theme.useToken();

  if (value === null || value === undefined) {
    return <Text type="secondary">-</Text>;
  }
  if (typeof value === 'boolean') {
    return <Tag color={value ? 'green' : 'default'}>{String(value)}</Tag>;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return (
      <code style={{
        fontSize: 12,
        background: token.colorFillQuaternary,
        padding: '1px 6px',
        borderRadius: 4,
        wordBreak: 'break-all',
      }}>
        {String(value)}
      </code>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <Text type="secondary">[]</Text>;
    // Simple string array → tags
    if (value.every(v => typeof v === 'string')) {
      return (
        <Space size={4} wrap>
          {value.map((v, i) => <Tag key={i} style={{ margin: 0 }}>{v}</Tag>)}
        </Space>
      );
    }
    // Complex array → JSON
    return (
      <pre style={{
        fontSize: 11, margin: 0, maxHeight: 200, overflow: 'auto',
        background: token.colorFillQuaternary, padding: 8, borderRadius: 4,
      }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <Text type="secondary">{'{}'}</Text>;
    return (
      <Descriptions size="small" column={1} bordered style={{ marginTop: 4 }}>
        {entries.map(([k, v]) => (
          <Descriptions.Item key={k} label={k}>
            <ConfigValue value={v} />
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  }
  return <Text>{String(value)}</Text>;
}

/** Agent config expanded row — loads config on expand. */
function AgentConfigExpanded({ record }: { record: AgentInfo }) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!record.available) return;
    setLoading(true);
    agentApi.getConfig(record.name)
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [record.name, record.available]);

  const configSections = config ? Object.entries(config) : [];

  return (
    <div>
      {/* Basic info */}
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Description" span={2}>
          {record.description}
        </Descriptions.Item>
        <Descriptions.Item label="Provider">
          {record.provider || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Model">
          {record.model || '-'}
        </Descriptions.Item>
        {record.install_hint && (
          <Descriptions.Item label="Install Command" span={2}>
            <code style={{ fontSize: 12 }}>{record.install_hint}</code>
          </Descriptions.Item>
        )}
        {record.tools.length > 0 && (
          <Descriptions.Item label="Tools" span={2}>
            <Space size={4} wrap>
              {record.tools.map(t => <Tag key={t}>{t}</Tag>)}
            </Space>
          </Descriptions.Item>
        )}
        {record.mcp_servers.length > 0 && (
          <Descriptions.Item label="MCP Servers" span={2}>
            <Space size={4} wrap>
              {record.mcp_servers.map(s => <Tag key={s} color="purple">{s}</Tag>)}
            </Space>
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Real config from settings file */}
      {loading && <Spin size="small" style={{ display: 'block', margin: '8px 0' }} />}
      {!loading && configSections.length > 0 && (
        <Collapse
          size="small"
          items={configSections.map(([section, data]) => ({
            key: section,
            label: (
              <Text strong style={{ fontSize: 12 }}>
                {section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Text>
            ),
            children: <ConfigValue value={data} />,
          }))}
          defaultActiveKey={configSections.map(([k]) => k)}
        />
      )}
      {!loading && record.available && configSections.length === 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          No configuration file found for this agent.
        </Text>
      )}
      {!record.available && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Agent is not installed. Install it first to view configuration.
        </Text>
      )}
    </div>
  );
}

export default function Settings() {
  const [quota, setQuota] = useState<UploadQuotaInfo | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [involveModalOpen, setInvolveModalOpen] = useState(false);

  const fetchQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      const info = await dataSourcesApi.getQuota();
      setQuota(info);
    } catch {
      // ignore — section will show fallback
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const list = await agentApi.getAvailable();
      setAgents(list);
    } catch {
      // ignore
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuota();
    fetchAgents();
  }, [fetchQuota, fetchAgents]);

  const handleRefreshAgents = async () => {
    message.loading({ content: 'Refreshing agent status...', key: 'agent-refresh' });
    await fetchAgents();
    message.success({ content: 'Agent status refreshed', key: 'agent-refresh' });
  };

  const usedPercent = quota ? Math.round((quota.used_mb / quota.total_mb) * 100) : 0;

  // Map between community list names and backend adapter names
  const ALIAS_MAP: Record<string, string> = {
    'github-copilot': 'copilot',
  };
  const registeredNames = new Set(agents.map(a => a.name));
  const isRegistered = (communityName: string) => {
    if (registeredNames.has(communityName)) return true;
    const alias = ALIAS_MAP[communityName];
    return alias ? registeredNames.has(alias) : false;
  };
  const findRegistered = (communityName: string) => {
    const direct = agents.find(a => a.name === communityName);
    if (direct) return direct;
    const alias = ALIAS_MAP[communityName];
    return alias ? agents.find(a => a.name === alias) : undefined;
  };

  const agentColumns = [
    {
      title: 'Agent',
      key: 'name',
      render: (_: unknown, record: AgentInfo) => (
        <Space size={8}>
          <AgentIcon name={record.icon} size={18} />
          <Text strong>{record.display_name}</Text>
        </Space>
      ),
    },
    {
      title: 'Provider',
      key: 'provider',
      width: 140,
      render: (_: unknown, record: AgentInfo) => (
        <Text type="secondary">{record.provider || '-'}</Text>
      ),
    },
    {
      title: 'Model',
      key: 'model',
      width: 140,
      render: (_: unknown, record: AgentInfo) => (
        <Text type="secondary">{record.model || '-'}</Text>
      ),
    },
    {
      title: 'Status',
      key: 'available',
      width: 100,
      render: (_: unknown, record: AgentInfo) => (
        <Tag color={record.available ? 'success' : 'default'}>
          {record.available ? 'Available' : 'Unavailable'}
        </Tag>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 180,
      render: (val: string | null) => val || '-',
    },
    {
      title: 'Modes',
      key: 'modes',
      width: 180,
      render: (_: unknown, record: AgentInfo) => (
        <Space size={4}>
          {record.modes.map(m => (
            <Tag key={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Tools',
      key: 'tools',
      width: 60,
      render: (_: unknown, record: AgentInfo) => record.tools.length || '-',
    },
    {
      title: 'MCP',
      key: 'mcp',
      width: 60,
      render: (_: unknown, record: AgentInfo) => record.mcp_servers.length || '-',
    },
  ];

  const collapseItems = [
    {
      key: 'configuration',
      label: (
        <Space>
          <SettingOutlined />
          <span>Configuration</span>
        </Space>
      ),
      children: (
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Version">0.1.0</Descriptions.Item>
          <Descriptions.Item label="Database">SQLite (local)</Descriptions.Item>
          <Descriptions.Item label="Sync Timeout">300s</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'agents',
      label: (
        <Space>
          <RobotOutlined />
          <span>Agent Configuration</span>
        </Space>
      ),
      extra: (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={handleRefreshAgents}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => setInvolveModalOpen(true)}
          >
            Involve Agent
          </Button>
        </Space>
      ),
      children: (
        <Table
          dataSource={agents}
          columns={agentColumns}
          rowKey="name"
          loading={agentsLoading}
          size="small"
          pagination={false}
          expandable={{
            expandedRowRender: (record: AgentInfo) => (
              <AgentConfigExpanded record={record} />
            ),
          }}
        />
      ),
    },
    {
      key: 'storage',
      label: (
        <Space>
          <CloudUploadOutlined />
          <span>Upload Storage</span>
        </Space>
      ),
      children: quotaLoading ? (
        <Spin />
      ) : quota ? (
        <>
          <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Temp Directory">{quota.temp_dir}</Descriptions.Item>
            <Descriptions.Item label="Max File Size">
              {quota.max_file_size_mb} MB
            </Descriptions.Item>
            <Descriptions.Item label="Total Quota">{quota.total_mb} MB</Descriptions.Item>
            <Descriptions.Item label="Used">{quota.used_mb.toFixed(1)} MB</Descriptions.Item>
            <Descriptions.Item label="Available">
              {quota.available_mb.toFixed(1)} MB
            </Descriptions.Item>
            <Descriptions.Item label="Retention">
              {quota.retention_days} days
            </Descriptions.Item>
          </Descriptions>
          <div style={{ maxWidth: 400 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Storage usage: {quota.used_mb.toFixed(1)} MB / {quota.total_mb} MB ({usedPercent}%)
            </Text>
            <Progress
              percent={usedPercent}
              strokeColor={quotaColor(usedPercent)}
              size="small"
            />
          </div>
        </>
      ) : (
        <Text type="secondary">Unable to load upload quota information.</Text>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>System Settings</Title>

      <Collapse
        defaultActiveKey={['configuration', 'agents', 'storage']}
        items={collapseItems}
        style={{ background: 'transparent' }}
        bordered={false}
        size="large"
      />

      {/* Involve Agent Modal */}
      <Modal
        title="Involve Community Agents"
        open={involveModalOpen}
        onCancel={() => setInvolveModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setInvolveModalOpen(false)}>
            Close
          </Button>,
          <Button
            key="refresh"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={async () => {
              await handleRefreshAgents();
              setInvolveModalOpen(false);
            }}
          >
            Refresh & Detect
          </Button>,
        ]}
        width={700}
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          将社区 CLI coding agent 引入到系统中。按照下方安装指引完成安装后，
          点击「Refresh & Detect」自动检测并注册到平台。
        </Paragraph>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {COMMUNITY_AGENTS.map(ca => {
            const registered = isRegistered(ca.name);
            const registeredAgent = findRegistered(ca.name);
            const isAvailable = registeredAgent?.available ?? false;
            return (
              <Card
                key={ca.name}
                size="small"
                style={{
                  borderColor: isAvailable ? '#52c41a' : undefined,
                  opacity: isAvailable ? 1 : 0.85,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <AgentIcon name={ca.icon} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                    }}>
                      <Text strong>{ca.display_name}</Text>
                      <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                        {ca.provider}
                      </Tag>
                      {registered && (
                        <Tag
                          color={isAvailable ? 'success' : 'default'}
                          style={{ margin: 0, fontSize: 10 }}
                        >
                          {isAvailable ? 'Installed' : 'Not Installed'}
                        </Tag>
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      {ca.description}
                    </Text>
                    <div style={{
                      marginTop: 6,
                      padding: '4px 8px',
                      background: '#f5f5f5',
                      borderRadius: 4,
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}>
                      $ {ca.install}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
