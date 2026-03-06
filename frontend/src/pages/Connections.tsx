import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { PlusOutlined, ApiOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import type { Connection } from '../types';
import { connectionsApi } from '../services/api';

const { Title } = Typography;

const CONNECTION_TYPES = [
  { label: 'Azure OpenAI', value: 'azure_openai' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Azure Document Intelligence', value: 'azure_doc_intelligence' },
  { label: 'Azure Content Understanding', value: 'azure_content_understanding' },
  { label: 'Azure AI Foundry', value: 'azure_ai_foundry' },
  { label: 'HTTP API', value: 'http_api' },
];

const typeColorMap: Record<string, string> = {
  azure_openai: 'blue',
  openai: 'green',
  azure_doc_intelligence: 'purple',
  azure_content_understanding: 'magenta',
  azure_ai_foundry: 'cyan',
  http_api: 'orange',
};

// Config fields per connection type
const CONFIG_FIELDS: Record<string, Array<{ name: string; label: string; secret?: boolean; required?: boolean }>> = {
  azure_openai: [
    { name: 'endpoint', label: 'Endpoint', required: true },
    { name: 'api_key', label: 'API Key', secret: true, required: true },
    { name: 'api_version', label: 'API Version' },
    { name: 'deployment_name', label: 'Deployment Name' },
  ],
  openai: [
    { name: 'api_key', label: 'API Key', secret: true, required: true },
    { name: 'organization', label: 'Organization' },
  ],
  azure_doc_intelligence: [
    { name: 'endpoint', label: 'Endpoint', required: true },
    { name: 'api_key', label: 'API Key', secret: true, required: true },
  ],
  azure_content_understanding: [
    { name: 'endpoint', label: 'Endpoint', required: true },
    { name: 'api_key', label: 'API Key', secret: true, required: true },
  ],
  azure_ai_foundry: [
    { name: 'endpoint', label: 'Endpoint', required: true },
    { name: 'api_key', label: 'API Key', secret: true, required: true },
    { name: 'project_name', label: 'Project Name' },
  ],
  http_api: [
    { name: 'base_url', label: 'Base URL', required: true },
    { name: 'auth_type', label: 'Auth Type' },
    { name: 'auth_value', label: 'Auth Value', secret: true },
  ],
};

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [formOpen, setFormOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('azure_openai');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchConnections = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const data = await connectionsApi.list(p, ps);
      setConnections(data.items);
      setTotal(data.total);
    } catch {
      message.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections(page, pageSize);
  }, [page, pageSize, fetchConnections]);

  const handleDelete = async (id: string) => {
    try {
      await connectionsApi.delete(id);
      message.success('Connection deleted');
      fetchConnections(page, pageSize);
    } catch {
      message.error('Failed to delete connection');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await connectionsApi.test(id);
      if (result.success) {
        message.success('Connection test successful');
      } else {
        message.error(`Connection test failed: ${result.message}`);
      }
    } catch {
      message.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await connectionsApi.setDefault(id);
      message.success('Default connection updated');
      fetchConnections(page, pageSize);
    } catch {
      message.error('Failed to set default');
    }
  };

  const openCreateForm = () => {
    setEditingConn(null);
    form.resetFields();
    setSelectedType('azure_openai');
    setFormOpen(true);
  };

  const openEditForm = (conn: Connection) => {
    setEditingConn(conn);
    setSelectedType(conn.connection_type);
    form.setFieldsValue({
      name: conn.name,
      description: conn.description || '',
      connection_type: conn.connection_type,
      ...conn.config,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setFormLoading(true);

      const fields = CONFIG_FIELDS[values.connection_type || selectedType] || [];
      const config: Record<string, string> = {};
      for (const f of fields) {
        if (values[f.name]) {
          config[f.name] = values[f.name];
        }
      }

      const payload = {
        name: values.name,
        description: values.description || null,
        connection_type: values.connection_type || selectedType,
        config,
      };

      if (editingConn) {
        await connectionsApi.update(editingConn.id, payload);
        message.success('Connection updated');
      } else {
        await connectionsApi.create(payload);
        message.success('Connection created');
      }

      setFormOpen(false);
      form.resetFields();
      fetchConnections(page, pageSize);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to save connection');
    } finally {
      setFormLoading(false);
    }
  };

  const columns = [
    {
      title: 'Default',
      key: 'is_default',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, record: Connection) => (
        <Button
          type="text"
          size="small"
          icon={record.is_default ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined style={{ color: '#d9d9d9' }} />}
          onClick={() => handleSetDefault(record.id)}
          title={record.is_default ? 'Default connection for this type' : 'Set as default'}
        />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Connection) => (
        <a onClick={() => openEditForm(record)}>{name}</a>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'connection_type',
      key: 'connection_type',
      width: 200,
      render: (type: string) => (
        <Tag icon={<ApiOutlined />} color={typeColorMap[type] || 'default'}>
          {CONNECTION_TYPES.find(t => t.value === type)?.label || type}
        </Tag>
      ),
    },
    {
      title: 'Endpoint / Details',
      key: 'details',
      ellipsis: true,
      render: (_: unknown, record: Connection) => {
        const cfg = record.config || {};
        const parts: string[] = [];
        if (cfg.endpoint) parts.push(String(cfg.endpoint));
        else if (cfg.base_url) parts.push(String(cfg.base_url));
        if (cfg.deployment_name) parts.push(`deployment: ${cfg.deployment_name}`);
        if (cfg.api_version) parts.push(`v${cfg.api_version}`);
        return parts.length > 0 ? (
          <Typography.Text type="secondary" ellipsis={{ tooltip: parts.join(' | ') }}>
            {parts.join(' | ')}
          </Typography.Text>
        ) : '-';
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_: unknown, record: Connection) => (
        <Space>
          <Button
            type="link"
            size="small"
            loading={testingId === record.id}
            onClick={() => handleTest(record.id)}
          >
            Test
          </Button>
          <Button type="link" size="small" onClick={() => openEditForm(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this connection?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const currentFields = CONFIG_FIELDS[selectedType] || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Connections
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateForm}>
          New Connection
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={connections}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} connections`,
          }}
        />
      </Card>

      <Modal
        title={editingConn ? 'Edit Connection' : 'New Connection'}
        open={formOpen}
        onCancel={() => { setFormOpen(false); form.resetFields(); }}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        okText={editingConn ? 'Update' : 'Create'}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter connection name' }]}
          >
            <Input placeholder="e.g. my-azure-openai" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
          <Form.Item
            name="connection_type"
            label="Type"
            rules={[{ required: true, message: 'Please select connection type' }]}
            initialValue="azure_openai"
          >
            <Select
              options={CONNECTION_TYPES}
              onChange={(v) => setSelectedType(v)}
              disabled={!!editingConn}
            />
          </Form.Item>

          {currentFields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `Please enter ${field.label}` }] : undefined}
            >
              <Input
                placeholder={
                  editingConn && field.secret
                    ? 'Leave empty to keep current value'
                    : `Enter ${field.label}`
                }
                type={field.secret ? 'password' : 'text'}
              />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}
