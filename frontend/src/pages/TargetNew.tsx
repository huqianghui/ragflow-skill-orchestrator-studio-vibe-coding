import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Steps,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import type { TargetType, Pipeline, TargetSchemaField, PipelineOutputField } from '../types';
import { targetsApi, pipelinesApi } from '../services/api';

const { Title, Text } = Typography;

// ── Config field definition ──

interface ConfigField {
  name: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}

interface TargetTypeDef {
  value: TargetType;
  label: string;
  category: 'search' | 'storage' | 'graph_db' | 'relational_db';
  categoryLabel: string;
  icon: string;
  configFields: ConfigField[];
}

const TARGET_TYPES: TargetTypeDef[] = [
  {
    value: 'azure_ai_search',
    label: 'Azure AI Search',
    category: 'search',
    categoryLabel: 'Search',
    icon: '/icons/targets/azure-ai-search.svg',
    configFields: [
      { name: 'endpoint', label: 'Endpoint', required: true, placeholder: 'https://xxx.search.windows.net' },
      { name: 'api_key', label: 'API Key', secret: true, required: true },
      { name: 'index_name', label: 'Index Name', placeholder: 'Optional — can be created when linking a pipeline' },
    ],
  },
  {
    value: 'azure_blob',
    label: 'Azure Blob Storage',
    category: 'storage',
    categoryLabel: 'Storage',
    icon: '/icons/targets/azure-blob-storage.svg',
    configFields: [
      { name: 'connection_string', label: 'Connection String', secret: true, required: true },
      { name: 'container_name', label: 'Container Name', required: true },
      { name: 'output_path_template', label: 'Output Path Template', placeholder: '{pipeline_name}/{date}_{index}.json' },
      { name: 'content_format', label: 'Content Format', defaultValue: 'json', placeholder: 'json | text | binary | jsonl' },
    ],
  },
  {
    value: 'cosmosdb_gremlin',
    label: 'CosmosDB (Gremlin)',
    category: 'graph_db',
    categoryLabel: 'Graph DB',
    icon: '/icons/targets/cosmosdb-gremlin.svg',
    configFields: [
      { name: 'endpoint', label: 'Endpoint', required: true, placeholder: 'wss://xxx.gremlin.cosmos.azure.com:443/' },
      { name: 'primary_key', label: 'Primary Key', secret: true, required: true },
      { name: 'database', label: 'Database', required: true },
      { name: 'graph', label: 'Graph', required: true },
      { name: 'partition_key', label: 'Partition Key', required: true, defaultValue: 'pk' },
    ],
  },
  {
    value: 'neo4j',
    label: 'Neo4j',
    category: 'graph_db',
    categoryLabel: 'Graph DB',
    icon: '/icons/targets/neo4j.svg',
    configFields: [
      { name: 'uri', label: 'URI', required: true, placeholder: 'bolt://localhost:7687' },
      { name: 'username', label: 'Username', required: true },
      { name: 'password', label: 'Password', secret: true, required: true },
      { name: 'database', label: 'Database', defaultValue: 'neo4j' },
    ],
  },
  {
    value: 'mysql',
    label: 'MySQL',
    category: 'relational_db',
    categoryLabel: 'Relational DB',
    icon: '/icons/targets/mysql.svg',
    configFields: [
      { name: 'host', label: 'Host', required: true },
      { name: 'port', label: 'Port', defaultValue: '3306' },
      { name: 'username', label: 'Username', required: true },
      { name: 'password', label: 'Password', secret: true, required: true },
      { name: 'database', label: 'Database', required: true },
      { name: 'table_name', label: 'Table Name', required: true },
    ],
  },
  {
    value: 'postgresql',
    label: 'PostgreSQL',
    category: 'relational_db',
    categoryLabel: 'Relational DB',
    icon: '/icons/targets/postgresql.svg',
    configFields: [
      { name: 'host', label: 'Host', required: true },
      { name: 'port', label: 'Port', defaultValue: '5432' },
      { name: 'username', label: 'Username', required: true },
      { name: 'password', label: 'Password', secret: true, required: true },
      { name: 'database', label: 'Database', required: true },
      { name: 'schema_name', label: 'Schema', defaultValue: 'public' },
      { name: 'table_name', label: 'Table Name', required: true },
    ],
  },
];

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'search', label: 'Search' },
  { key: 'storage', label: 'Storage' },
  { key: 'graph_db', label: 'Graph DB' },
  { key: 'relational_db', label: 'Relational DB' },
];

const TYPE_COLORS: Record<string, string> = {
  azure_ai_search: 'blue',
  azure_blob: 'cyan',
  cosmosdb_gremlin: 'purple',
  neo4j: 'green',
  mysql: 'orange',
  postgresql: 'geekblue',
};

export default function TargetNew() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState<TargetTypeDef | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [formLoading, setFormLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [form] = Form.useForm();
  const pipelineId = Form.useWatch('pipeline_id', form);
  const hasPipeline = !!pipelineId;
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [createdTargetId, setCreatedTargetId] = useState<string | null>(null);

  // Schema mapping state
  const [pipelineOutputs, setPipelineOutputs] = useState<PipelineOutputField[]>([]);
  const [targetSchema, setTargetSchema] = useState<TargetSchemaField[]>([]);
  const [mappingRows, setMappingRows] = useState<Array<{ source: string; target: string }>>([]);
  const [schemaExists, setSchemaExists] = useState(true);
  const [suggestedSchema, setSuggestedSchema] = useState<TargetSchemaField[] | null>(null);

  useEffect(() => {
    pipelinesApi.list(1, 100).then((res) => setPipelines(res.items)).catch(() => {});
  }, []);

  const filtered = TARGET_TYPES.filter(
    (t) => t.label.toLowerCase().includes(filter.toLowerCase())
  );

  const handleCardClick = (typeDef: TargetTypeDef) => {
    setSelectedType(typeDef);
    setStep(0);
    setCreatedTargetId(null);
    setPipelineOutputs([]);
    setTargetSchema([]);
    setMappingRows([]);
    setSchemaExists(true);
    setSuggestedSchema(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTestLoading(true);

      const config: Record<string, string> = {};
      if (selectedType) {
        for (const f of selectedType.configFields) {
          if (values[f.name]) config[f.name] = values[f.name];
        }
      }

      const target = await targetsApi.create({
        name: values.name || `test-${Date.now()}`,
        description: values.description || null,
        target_type: selectedType?.value,
        connection_config: config,
        pipeline_id: values.pipeline_id || null,
      });

      const result = await targetsApi.test(target.id);
      if (result.success) {
        message.success(result.message);
        setCreatedTargetId(target.id);
      } else {
        message.error(result.message);
        await targetsApi.delete(target.id);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const handleCreateDirect = async () => {
    try {
      const values = await form.validateFields();
      setFormLoading(true);

      const config: Record<string, string> = {};
      if (selectedType) {
        for (const f of selectedType.configFields) {
          if (values[f.name]) config[f.name] = values[f.name];
        }
      }

      // Reuse already-created target from Test, or create new
      if (!createdTargetId) {
        await targetsApi.create({
          name: values.name,
          description: values.description || null,
          target_type: selectedType?.value,
          connection_config: config,
          pipeline_id: null,
        });
      }
      message.success('Target created');
      setModalOpen(false);
      navigate('/targets');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to create target');
    } finally {
      setFormLoading(false);
    }
  };

  const handleNext = async () => {
    try {
      const values = await form.validateFields();

      // Create target if not already created via Test
      if (!createdTargetId) {
        setFormLoading(true);
        const config: Record<string, string> = {};
        if (selectedType) {
          for (const f of selectedType.configFields) {
            if (values[f.name]) config[f.name] = values[f.name];
          }
        }
        const target = await targetsApi.create({
          name: values.name,
          description: values.description || null,
          target_type: selectedType?.value,
          connection_config: config,
          pipeline_id: values.pipeline_id || null,
        });
        setCreatedTargetId(target.id);
        setFormLoading(false);
      }

      // Load schema discovery & pipeline outputs for step 2
      if (createdTargetId || true) {
        const tid = createdTargetId || ''; // will be set above
        if (tid) {
          try {
            const discovery = await targetsApi.discoverSchema(tid);
            setSchemaExists(discovery.exists);
            setTargetSchema(discovery.schema_fields || []);
            setSuggestedSchema(discovery.suggested_schema || null);
          } catch { /* ignore */ }

          try {
            const outputsResult = await targetsApi.getPipelineOutputs(tid);
            setPipelineOutputs(outputsResult.outputs || []);
          } catch { /* ignore */ }
        }
      }

      setStep(1);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Please fill in required fields');
    }
  };

  const handleSave = async () => {
    if (!createdTargetId) return;
    setFormLoading(true);
    try {
      const fieldMappings: Record<string, unknown> = {
        write_context: '/document',
        write_mode: 'upsert',
        mappings: mappingRows.filter((r) => r.source && r.target).map((r) => ({
          source: r.source,
          target: r.target,
          target_type: 'string',
        })),
      };
      await targetsApi.update(createdTargetId, { field_mappings: fieldMappings });
      message.success('Target created');
      setModalOpen(false);
      navigate('/targets');
    } catch {
      message.error('Failed to save target');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateIndex = async () => {
    if (!createdTargetId || !suggestedSchema) return;
    try {
      await targetsApi.createIndex(createdTargetId, {
        index_definition: suggestedSchema as unknown as unknown[],
      });
      message.success('Index created');
      setSchemaExists(true);
      setTargetSchema(suggestedSchema);
      setSuggestedSchema(null);
    } catch {
      message.error('Failed to create index');
    }
  };

  const isBlob = selectedType?.value === 'azure_blob';
  const isGraph = selectedType?.value === 'cosmosdb_gremlin' || selectedType?.value === 'neo4j';

  const renderStep2 = () => {
    if (isBlob) {
      return (
        <div>
          <Text strong>Blob Path Configuration</Text>
          <p style={{ color: '#666', marginTop: 8 }}>
            Path template and content format are configured in the connection settings.
          </p>
        </div>
      );
    }

    if (isGraph) {
      return (
        <div>
          <Text strong>Graph Mapping</Text>
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              Configure vertex and edge source paths in the field_mappings JSON after creation.
              The graph_mapping section supports vertex_source, edge_source, and property fields.
            </Text>
          </div>
        </div>
      );
    }

    // Schema mapping for search / relational
    return (
      <div>
        <Text strong>Schema Mapping</Text>
        {!schemaExists && selectedType?.value === 'azure_ai_search' && suggestedSchema && (
          <div style={{ margin: '12px 0', padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6 }}>
            <Text>Index not found.</Text>{' '}
            <Button size="small" type="primary" onClick={handleCreateIndex}>
              Create Index
            </Button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Pipeline Outputs</Text>
            {pipelineOutputs.length === 0 ? (
              <Text type="secondary">Select a pipeline to see available outputs</Text>
            ) : (
              pipelineOutputs.map((o) => (
                <Tag key={o.path} style={{ margin: '2px 4px' }}>{o.path.split('/').pop()} ({o.type})</Tag>
              ))
            )}
          </div>
          <div style={{ flex: 1 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Target Schema</Text>
            {targetSchema.length === 0 ? (
              <Text type="secondary">No schema discovered</Text>
            ) : (
              targetSchema.map((f) => (
                <Tag key={f.name} color={f.key ? 'gold' : undefined} style={{ margin: '2px 4px' }}>
                  {f.name} ({f.type})
                </Tag>
              ))
            )}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Mappings</Text>
          {mappingRows.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Select
                style={{ flex: 1 }}
                placeholder="Source field"
                value={row.source || undefined}
                onChange={(val) => {
                  const updated = [...mappingRows];
                  updated[idx] = { ...updated[idx], source: val };
                  setMappingRows(updated);
                }}
                options={pipelineOutputs.map((o) => ({ label: o.path, value: o.path }))}
              />
              <span style={{ lineHeight: '32px' }}>&rarr;</span>
              <Select
                style={{ flex: 1 }}
                placeholder="Target field"
                value={row.target || undefined}
                onChange={(val) => {
                  const updated = [...mappingRows];
                  updated[idx] = { ...updated[idx], target: val };
                  setMappingRows(updated);
                }}
                options={targetSchema.map((f) => ({ label: f.name, value: f.name }))}
              />
              <Button
                size="small"
                danger
                onClick={() => setMappingRows(mappingRows.filter((_, i) => i !== idx))}
              >
                X
              </Button>
            </div>
          ))}
          <Button
            type="dashed"
            size="small"
            onClick={() => setMappingRows([...mappingRows, { source: '', target: '' }])}
          >
            + Add Mapping
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/targets')}
        style={{ padding: 0, marginBottom: 16 }}
      >
        Back to Output Targets
      </Button>

      <Title level={3}>Choose an output target</Title>
      <Text type="secondary">Select a target type to configure.</Text>

      <Input
        prefix={<SearchOutlined />}
        placeholder="Filter by name..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ maxWidth: 400, margin: '16px 0' }}
        allowClear
      />

      {CATEGORIES.map((cat) => {
        const items = filtered.filter((t) => t.category === cat.key);
        if (items.length === 0) return null;
        return (
          <div key={cat.key} style={{ marginBottom: 24 }}>
            <Text strong style={{ fontSize: 14, color: '#666', display: 'block', marginBottom: 12 }}>
              {cat.label}
            </Text>
            <Row gutter={[16, 16]}>
              {items.map((t) => (
                <Col key={t.value} xs={24} sm={12} md={8}>
                  <Card
                    hoverable
                    onClick={() => handleCardClick(t)}
                    style={{ cursor: 'pointer' }}
                    styles={{ body: { padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 } }}
                  >
                    <img
                      src={t.icon}
                      alt={t.label}
                      style={{ width: 48, height: 48, flexShrink: 0 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{t.label}</div>
                      <Tag color={TYPE_COLORS[t.value]} style={{ marginTop: 4 }}>{t.categoryLabel}</Tag>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        );
      })}

      <Modal
        title={`Configure ${selectedType?.label || ''}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={
          step === 0
            ? [
                <Button key="cancel" onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancel</Button>,
                <Button key="test" loading={testLoading} onClick={handleTest}>Test</Button>,
                hasPipeline
                  ? <Button key="next" type="primary" loading={formLoading} onClick={handleNext}>Next</Button>
                  : <Button key="create" type="primary" loading={formLoading} onClick={handleCreateDirect}>Create</Button>,
              ]
            : [
                <Button key="back" onClick={() => setStep(0)}>Back</Button>,
                <Button key="save" type="primary" loading={formLoading} onClick={handleSave}>Create</Button>,
              ]
        }
        destroyOnClose
        width={700}
      >
        {hasPipeline && (
          <Steps
            current={step}
            size="small"
            style={{ marginBottom: 24 }}
            items={[{ title: 'Connection' }, { title: 'Mapping' }]}
          />
        )}

        {step === 0 && (
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Please enter a name' }]}
            >
              <Input placeholder="e.g. my-search-index" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={2} placeholder="Optional description" />
            </Form.Item>
            <Form.Item name="pipeline_id" label="Pipeline (optional)">
              <Select
                allowClear
                placeholder="Select a pipeline for schema inference"
                options={pipelines.map((p) => ({ label: p.name, value: p.id }))}
              />
            </Form.Item>

            {selectedType && (
              <>
                <div style={{ borderTop: '1px solid #f0f0f0', margin: '16px 0 12px', paddingTop: 12 }}>
                  <Text strong>Connection</Text>
                </div>
                {selectedType.configFields.map((field) => (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={field.required ? [{ required: true, message: `Please enter ${field.label}` }] : undefined}
                    initialValue={field.defaultValue}
                  >
                    <Input
                      placeholder={field.placeholder || `Enter ${field.label}`}
                      type={field.secret ? 'password' : 'text'}
                    />
                  </Form.Item>
                ))}
              </>
            )}
          </Form>
        )}

        {step === 1 && renderStep2()}
      </Modal>
    </div>
  );
}
