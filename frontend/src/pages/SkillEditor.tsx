import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Input,
  message,
  Select,
  Space,
  Spin,
  Tag,
  theme,
  Typography,
} from 'antd';
import {
  CaretRightOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { Connection, PreloadedImports, SkillTestResult } from '../types';
import type { AgentInfo } from '../types/agent';
import { connectionsApi, skillsApi } from '../services/api';
import { agentApi } from '../services/agentApi';
import PageHeader from '../components/PageHeader';
import AgentChatWidget from '../components/agent/AgentChatWidget';
import AgentSelector from '../components/agent/AgentSelector';

const { Text } = Typography;
const { TextArea } = Input;

const DEFAULT_CODE = `def process(data: dict, context) -> dict:
    """
    Process a single record.

    Args:
        data: The input record data dict
        context: Runtime context with get_client(), config, logger
    Returns:
        dict with processed results
    """
    # Example: echo the input data
    return {"result": data}
`;

const DEFAULT_TEST_INPUT = JSON.stringify(
  {
    values: [
      {
        recordId: '1',
        data: {
          text: 'Hello, World!',
        },
      },
    ],
  },
  null,
  2,
);

export default function SkillEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configPanels, setConfigPanels] = useState<string | string[]>(['connections', 'requirements', 'test']);
  const { token } = theme.useToken();

  // Skill fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceCode, setSourceCode] = useState(DEFAULT_CODE);
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [testInputStr, setTestInputStr] = useState(DEFAULT_TEST_INPUT);
  const [connectionMappings, setConnectionMappings] = useState<Array<{ name: string; connectionId: string }>>([]);

  // Preloaded imports
  const [preloadedImports, setPreloadedImports] = useState<PreloadedImports | null>(null);

  // Connections for dropdown
  const [connections, setConnections] = useState<Connection[]>([]);

  // Test results
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);

  // Agent state
  const [agentList, setAgentList] = useState<AgentInfo[]>([]);
  const [selectedAgentName, setSelectedAgentName] = useState('');
  const [selectedAgentMode, setSelectedAgentMode] = useState('ask');

  // Warn on unsaved changes when leaving page
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const fetchPreloadedImports = useCallback(async () => {
    try {
      const data = await skillsApi.getPreloadedImports();
      setPreloadedImports(data);
    } catch {
      // ignore
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await connectionsApi.list(1, 100);
      setConnections(data.items);
    } catch {
      // ignore
    }
  }, []);

  const fetchSkill = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const skill = await skillsApi.get(id!);
      setName(skill.name);
      setDescription(skill.description || '');
      setSourceCode(skill.source_code || DEFAULT_CODE);
      setAdditionalRequirements(skill.additional_requirements || '');
      if (skill.test_input) {
        setTestInputStr(JSON.stringify(skill.test_input, null, 2));
      }
      if (skill.connection_mappings) {
        setConnectionMappings(
          Object.entries(skill.connection_mappings).map(([n, cid]) => ({
            name: n,
            connectionId: cid,
          })),
        );
      }
    } catch {
      message.error('Failed to load skill');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  const fetchAgents = useCallback(async () => {
    try {
      const list = await agentApi.getAvailable();
      setAgentList(list);
      const first = list.find(a => a.available);
      if (first) {
        setSelectedAgentName(first.name);
        setSelectedAgentMode(first.modes.includes('ask') ? 'ask' : first.modes[0] || 'code');
      }
    } catch { /* agents may not be configured */ }
  }, []);

  useEffect(() => {
    fetchPreloadedImports();
    fetchConnections();
    fetchSkill();
    fetchAgents();
  }, [fetchPreloadedImports, fetchConnections, fetchSkill, fetchAgents]);

  const handleSave = async () => {
    if (!name.trim()) {
      message.error('Please enter a skill name');
      return;
    }
    setSaving(true);
    try {
      const mappings: Record<string, string> = {};
      for (const m of connectionMappings) {
        if (m.name && m.connectionId) {
          mappings[m.name] = m.connectionId;
        }
      }

      let testInput = null;
      try {
        testInput = JSON.parse(testInputStr);
      } catch {
        // ignore invalid JSON for test_input
      }

      const basePayload = {
        description: description || null,
        skill_type: 'python_code' as const,
        source_code: sourceCode,
        additional_requirements: additionalRequirements || null,
        test_input: testInput,
        connection_mappings: Object.keys(mappings).length > 0 ? mappings : null,
      };

      if (isNew) {
        const created = await skillsApi.create({ ...basePayload, name });
        message.success('Skill created');
        setDirty(false);
        navigate(`/skills/${created.id}/edit`, { replace: true });
      } else {
        await skillsApi.update(id!, basePayload);
        message.success('Skill saved');
        setDirty(false);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 409) {
        message.error(axiosErr.response.data?.message || 'Skill name already exists');
      } else {
        message.error('Failed to save skill');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    let testInput;
    try {
      testInput = JSON.parse(testInputStr);
    } catch {
      message.error('Invalid JSON in test input');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const mappings: Record<string, string> = {};
      for (const m of connectionMappings) {
        if (m.name && m.connectionId) mappings[m.name] = m.connectionId;
      }

      let result: SkillTestResult;
      if (isNew) {
        result = await skillsApi.testCode({
          source_code: sourceCode,
          connection_mappings: Object.keys(mappings).length > 0 ? mappings : null,
          test_input: testInput,
        });
      } else {
        // Save first, then test
        result = await skillsApi.test(id!, testInput);
      }
      setTestResult(result);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Test failed'
        : 'Test failed';
      message.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const addConnectionMapping = () => {
    setConnectionMappings([...connectionMappings, { name: '', connectionId: '' }]);
    setDirty(true);
  };

  const removeConnectionMapping = (index: number) => {
    setConnectionMappings(connectionMappings.filter((_, i) => i !== index));
    setDirty(true);
  };

  const updateConnectionMapping = (index: number, field: 'name' | 'connectionId', value: string) => {
    const updated = [...connectionMappings];
    updated[index] = { ...updated[index], [field]: value };
    setConnectionMappings(updated);
    setDirty(true);
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  const hasErrors = testResult?.values.some(v => v.errors.length > 0);

  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0 }}>
        <PageHeader
          title={isNew ? 'New Python Skill' : `Edit: ${name}`}
          onBack={() => {
            if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
            navigate('/skills');
          }}
          extra={
            <Space>
              <Button
                type={showAgent ? 'primary' : 'default'}
                icon={<RobotOutlined />}
                onClick={() => {
                  setShowAgent(prev => {
                    if (!prev) setSidebarCollapsed(false);
                    return !prev;
                  });
                }}
              >
                Agent
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                Save
              </Button>
            </Space>
          }
        />
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left panel: Code Editor */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <Card size="small" title="Skill Info" style={{ marginBottom: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input
                placeholder="Skill name"
                value={name}
                disabled={!isNew}
                onChange={(e) => { setName(e.target.value); setDirty(true); }}
              />
              <Input.TextArea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
                rows={2}
              />
            </Space>
          </Card>

          {/* Preloaded Imports */}
          {preloadedImports && (
            <Collapse
              size="small"
              style={{ marginBottom: 12 }}
              items={[
                {
                  key: 'imports',
                  label: <Text type="secondary">Preloaded Imports (read-only)</Text>,
                  children: (
                    <pre style={{ margin: 0, fontSize: 12, color: '#888', background: '#fafafa', padding: 8, borderRadius: 4 }}>
                      {[...preloadedImports.standard_library, '', ...preloadedImports.third_party].join('\n')}
                    </pre>
                  ),
                },
              ]}
            />
          )}

          {/* Monaco Editor */}
          <Card
            size="small"
            title="Your Code"
            style={{ marginBottom: 12 }}
            bodyStyle={{ padding: 0 }}
          >
            <Editor
              height="400px"
              language="python"
              theme="vs-light"
              value={sourceCode}
              onChange={(v) => { setSourceCode(v || ''); setDirty(true); }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </Card>
        </div>

        {/* Right panel — collapsible, Config / Agent mutually exclusive */}
        <div style={{
          width: sidebarCollapsed ? 40 : 400,
          minWidth: sidebarCollapsed ? 40 : 400,
          flexShrink: 0,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgLayout,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s, min-width 0.2s',
        }}>
          {/* Collapse toggle */}
          <div
            onClick={() => setSidebarCollapsed(prev => !prev)}
            style={{
              height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              color: token.colorTextSecondary, fontSize: 18,
              flexShrink: 0,
            }}
          >
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          {!sidebarCollapsed && (showAgent ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Collapse
                size="small"
                activeKey={['agent']}
                onChange={(keys) => {
                  const arr = Array.isArray(keys) ? keys : keys ? [keys] : [];
                  if (!arr.includes('agent')) setShowAgent(false);
                }}
                destroyOnHidden={false}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                items={[{
                  key: 'agent',
                  label: 'Agent Assistant',
                  children: (
                    <div style={{ height: 'calc(100vh - 260px)', overflow: 'hidden' }}>
                      <AgentSelector
                        compact
                        agents={agentList}
                        selectedAgent={selectedAgentName}
                        selectedMode={selectedAgentMode}
                        onAgentChange={setSelectedAgentName}
                        onModeChange={setSelectedAgentMode}
                      />
                      <AgentChatWidget
                        embedded
                        agents={agentList}
                        agentName={selectedAgentName}
                        agentMode={selectedAgentMode}
                        onModeChange={setSelectedAgentMode}
                        autoContext={{
                          type: 'skill',
                          data: { name, description, source_code: sourceCode },
                        }}
                        onApplyCode={(code) => { setSourceCode(code); setDirty(true); }}
                      />
                    </div>
                  ),
                }]}
              />
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'hidden' }}>
            <Collapse
              size="small"
              activeKey={configPanels}
              onChange={(key) => setConfigPanels(key)}
              destroyOnHidden={false}
              items={[
                {
                  key: 'connections',
                  label: 'Connection Mappings',
                  children: (
                    <>
                      {connectionMappings.map((m, i) => (
                        <Space key={i} style={{ display: 'flex', marginBottom: 8 }} align="start">
                          <Input
                            placeholder="Name (e.g. llm)"
                            value={m.name}
                            onChange={(e) => updateConnectionMapping(i, 'name', e.target.value)}
                            style={{ width: 120 }}
                          />
                          <Select
                            placeholder="Select connection"
                            value={m.connectionId || undefined}
                            onChange={(v) => updateConnectionMapping(i, 'connectionId', v)}
                            style={{ width: 200 }}
                            options={connections.map((c) => ({
                              label: `${c.name} (${c.connection_type})`,
                              value: c.id,
                            }))}
                          />
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeConnectionMapping(i)}
                          />
                        </Space>
                      ))}
                      <Button type="dashed" block icon={<PlusOutlined />} onClick={addConnectionMapping}>
                        Add Connection
                      </Button>
                    </>
                  ),
                },
                {
                  key: 'requirements',
                  label: 'Additional Requirements',
                  children: (
                    <TextArea
                      rows={3}
                      placeholder="One pip package per line, e.g.&#10;beautifulsoup4==4.12.0&#10;lxml"
                      value={additionalRequirements}
                      onChange={(e) => { setAdditionalRequirements(e.target.value); setDirty(true); }}
                    />
                  ),
                },
                {
                  key: 'test',
                  label: (
                    <Space>
                      Test Input & Output
                      {testResult && (
                        testResult.error ? (
                          <Tag color="red">Timeout</Tag>
                        ) : hasErrors ? (
                          <Tag color="red">Errors</Tag>
                        ) : (
                          <Tag color="green">Success</Tag>
                        )
                      )}
                    </Space>
                  ),
                  children: (
                    <>
                      <Editor
                        height="200px"
                        language="json"
                        theme="vs-light"
                        value={testInputStr}
                        onChange={(v) => { setTestInputStr(v || ''); setDirty(true); }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          lineNumbers: 'off',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          wordWrap: 'on',
                        }}
                      />
                      <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                        <Button
                          disabled
                          block
                          title="Available after Pipeline execution engine is implemented (Phase 2)"
                        >
                          Import from Pipeline Test Run
                        </Button>
                        <Button
                          type="primary"
                          icon={<CaretRightOutlined />}
                          loading={testing}
                          onClick={handleTest}
                          block
                        >
                          Run Test
                        </Button>
                      </Space>

                      {testResult && (
                        <div style={{ marginTop: 12 }}>
                          {testResult.error && (
                            <Alert type="error" message={testResult.error} style={{ marginBottom: 8 }} />
                          )}
                          {testResult.values.map((v, i) => (
                            <div key={i} style={{ marginBottom: 8 }}>
                              <Text strong>Record: {v.recordId}</Text>
                              {v.errors.length > 0 && (
                                <Alert
                                  type="error"
                                  message={v.errors.map((e) => e.message).join('; ')}
                                  description={v.errors[0]?.traceback && (
                                    <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', margin: 0 }}>
                                      {v.errors[0].traceback}
                                    </pre>
                                  )}
                                  style={{ marginTop: 4 }}
                                />
                              )}
                              {v.errors.length === 0 && (
                                <pre style={{
                                  margin: '4px 0',
                                  padding: 8,
                                  background: '#f6ffed',
                                  border: '1px solid #b7eb8f',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  maxHeight: 200,
                                  overflow: 'auto',
                                }}>
                                  {JSON.stringify(v.data, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                          {testResult.logs.length > 0 && (
                            <Collapse
                              size="small"
                              items={[
                                {
                                  key: 'logs',
                                  label: `Logs (${testResult.logs.length})`,
                                  children: (
                                    <div style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                      {testResult.logs.map((log, li) => (
                                        <div key={li} style={{ marginBottom: 2 }}>
                                          <Tag
                                            color={log.level === 'ERROR' ? 'red' : log.level === 'WARNING' ? 'orange' : 'blue'}
                                            style={{ fontSize: 10 }}
                                          >
                                            {log.level}
                                          </Tag>
                                          <Text>{log.message}</Text>
                                        </div>
                                      ))}
                                    </div>
                                  ),
                                },
                              ]}
                            />
                          )}
                        </div>
                      )}
                    </>
                  ),
                },
              ]}
            />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
