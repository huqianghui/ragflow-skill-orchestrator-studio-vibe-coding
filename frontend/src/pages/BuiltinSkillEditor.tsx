import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  message,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  CaretRightOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { Connection, Skill, SkillTestResult } from '../types';
import { connectionsApi, skillsApi } from '../services/api';
import ConfigSchemaForm from '../components/ConfigSchemaForm';

const { Title, Text, Paragraph } = Typography;

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  azure_ai_foundry: 'Azure AI Foundry (multi-service)',
  azure_openai: 'Azure OpenAI',
  azure_content_understanding: 'Azure Content Understanding',
  azure_doc_intelligence: 'Azure Document Intelligence',
  openai: 'OpenAI',
  http_api: 'HTTP API',
};

export default function BuiltinSkillEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [boundConnectionId, setBoundConnectionId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);
  const [testInputText, setTestInputText] = useState('');
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [skillData, connData, defaultsData] = await Promise.all([
        skillsApi.get(id),
        connectionsApi.list(1, 100),
        connectionsApi.getDefaults(),
      ]);
      setSkill(skillData);
      setConnections(connData.items);

      // Set bound connection: saved value, or auto-select default
      let connId = skillData.bound_connection_id;
      if (!connId && skillData.required_resource_types?.length) {
        const targetType = skillData.required_resource_types[0];
        const defaultConn = defaultsData[targetType];
        if (defaultConn) {
          connId = defaultConn.id;
        }
      }
      setBoundConnectionId(connId);

      // Populate config form with saved values or schema defaults
      const configValues: Record<string, unknown> = {};
      const schema = skillData.config_schema as { properties?: Record<string, { default?: unknown }> };
      if (schema?.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          configValues[key] = prop.default;
        }
      }
      if (skillData.config_values) {
        Object.assign(configValues, skillData.config_values);
      }
      form.setFieldsValue(configValues);
    } catch {
      message.error('Failed to load skill');
    } finally {
      setLoading(false);
    }
  }, [id, form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const compatibleConnections = connections.filter((c) =>
    skill?.required_resource_types?.includes(c.connection_type)
  );

  const handleSave = async () => {
    if (!id || !skill) return;
    setSaving(true);
    try {
      const configValues = form.getFieldsValue();
      await skillsApi.configure(id, {
        config_values: configValues,
        bound_connection_id: boundConnectionId,
      });
      message.success('Configuration saved');
    } catch {
      message.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!id || !skill) return;
    setTesting(true);
    setTestResult(null);
    try {
      let testInput: Record<string, unknown>;
      if (uploadedFileId) {
        testInput = {
          values: [{ recordId: '1', data: { file_id: uploadedFileId, file_name: uploadedFileName } }],
        };
      } else {
        testInput = {
          values: [{ recordId: '1', data: { text: testInputText } }],
        };
      }
      const configOverride = form.getFieldsValue();
      const result = await skillsApi.test(id, testInput, configOverride);
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

  const handleFileUpload = async (file: File) => {
    try {
      const result = await skillsApi.uploadTestFile(file);
      setUploadedFileId(result.file_id);
      setUploadedFileName(result.filename);
      message.success(`File uploaded: ${result.filename}`);
    } catch {
      message.error('Failed to upload file');
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!skill) {
    return <Alert type="error" message="Skill not found" />;
  }

  const hasErrors = testResult?.values.some((v) => v.errors.length > 0);
  const needsResource = skill.required_resource_types && skill.required_resource_types.length > 0;
  const schema = skill.config_schema as { type: string; properties?: Record<string, unknown> };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button onClick={() => navigate('/skills')}>Back</Button>
          <Title level={3} style={{ margin: 0 }}>
            {skill.name}
          </Title>
          <Tag color="blue">Built-in</Tag>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          Save
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left panel: Config */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card size="small" title="Description" style={{ marginBottom: 12 }}>
            <Paragraph>{skill.description}</Paragraph>
          </Card>

          {/* Resource Binding */}
          <Card size="small" title="Resource Binding" style={{ marginBottom: 12 }}>
            {needsResource ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">
                  Required: {skill.required_resource_types!.map((t) => RESOURCE_TYPE_LABELS[t] || t).join(' or ')}
                </Text>
                <Select
                  placeholder="Select a connection"
                  value={boundConnectionId || undefined}
                  onChange={(v) => setBoundConnectionId(v)}
                  style={{ width: '100%' }}
                  options={compatibleConnections.map((c) => {
                    const detail = c.config?.deployment_name
                      ? ` [${c.config.deployment_name}]`
                      : c.config?.endpoint
                        ? ` [${c.config.endpoint}]`
                        : '';
                    return {
                      label: `${c.name}${detail}${c.is_default ? ' - default' : ''}`,
                      value: c.id,
                    };
                  })}
                />
                {boundConnectionId && (
                  <Text type="success">
                    <CheckCircleOutlined /> Connection selected
                  </Text>
                )}
                {!boundConnectionId && compatibleConnections.length === 0 && (
                  <Alert type="warning" message="No compatible connections found. Please create one in the Connections page." showIcon />
                )}
              </Space>
            ) : (
              <Text type="success">
                <CheckCircleOutlined /> No external resource needed (local execution)
              </Text>
            )}
          </Card>

          {/* Configuration Form */}
          {schema?.properties && Object.keys(schema.properties).length > 0 && (
            <Card size="small" title="Configuration" style={{ marginBottom: 12 }}>
              <Form form={form} layout="vertical" size="small">
                <ConfigSchemaForm schema={schema as { type: string; properties: Record<string, { type: string; enum?: string[]; items?: { type: string }; default?: unknown; description?: string; minimum?: number; maximum?: number }>; required?: string[] }} />
              </Form>
            </Card>
          )}
        </div>

        {/* Right panel: Test */}
        <div style={{ width: 420, flexShrink: 0 }}>
          <Card size="small" title="Test Input" style={{ marginBottom: 12 }}>
            <Input.TextArea
              rows={6}
              placeholder="Enter test text here..."
              value={testInputText}
              onChange={(e) => { setTestInputText(e.target.value); setUploadedFileId(null); setUploadedFileName(null); }}
            />
            <Space style={{ marginTop: 8, width: '100%' }} direction="vertical">
              <Space>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload File
                </Button>
                {uploadedFileName && (
                  <Tag color="blue">{uploadedFileName}</Tag>
                )}
              </Space>
              <Button
                type="primary"
                icon={<CaretRightOutlined />}
                loading={testing}
                onClick={handleTest}
                block
                disabled={!testInputText && !uploadedFileId}
              >
                Run Test
              </Button>
            </Space>
          </Card>

          {/* Test Output */}
          {testResult && (
            <Card
              size="small"
              title={
                <Space>
                  Output
                  {testResult.error ? (
                    <Tag color="red">Timeout</Tag>
                  ) : hasErrors ? (
                    <Tag color="red">Errors</Tag>
                  ) : (
                    <Tag color="green">Success</Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {testResult.execution_time_ms}ms
                  </Text>
                </Space>
              }
            >
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
                      margin: '4px 0', padding: 8,
                      background: '#f6ffed', border: '1px solid #b7eb8f',
                      borderRadius: 4, fontSize: 12, maxHeight: 300, overflow: 'auto',
                    }}>
                      {JSON.stringify(v.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}

              {testResult.logs.length > 0 && (
                <Collapse
                  size="small"
                  items={[{
                    key: 'logs',
                    label: `Logs (${testResult.logs.length})`,
                    children: (
                      <div style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                        {testResult.logs.map((log, i) => (
                          <div key={i} style={{ marginBottom: 2 }}>
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
                  }]}
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
