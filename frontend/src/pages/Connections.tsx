import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Switch,
  Table,
  Tag,
} from 'antd';
import { PlusOutlined, ApiOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Connection } from '../types';
import { connectionsApi } from '../services/api';
import { ResizableTitle, OverflowPopover, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';

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

  // Search
  const [searchText, setSearchText] = useState('');

  // Resizable column widths
  const [colWidths, setColWidths] = useState({ name: 200, details: 280, description: 200 });
  const handleResize = makeResizeHandler(setColWidths);

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

  // Client-side search filter
  const filteredConnections = useMemo(() => {
    if (!searchText) return connections;
    const lower = searchText.toLowerCase();
    return connections.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.description && c.description.toLowerCase().includes(lower)),
    );
  }, [connections, searchText]);

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
      is_default: conn.is_default,
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
        is_default: values.is_default ?? false,
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

  const columns: ColumnsType<Connection> = [
    {
      title: 'Default',
      key: 'is_default',
      width: 80,
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
      width: colWidths.name,
      sorter: (a, b) => a.name.localeCompare(b.name),
      onHeaderCell: () => ({
        width: colWidths.name,
        onResize: handleResize('name', 100),
      }),
      render: (name: string, record: Connection) => (
        <a onClick={() => openEditForm(record)}>
          <OverflowPopover text={name} />
        </a>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'connection_type',
      key: 'connection_type',
      width: 200,
      sorter: (a, b) => a.connection_type.localeCompare(b.connection_type),
      render: (type: string) => (
        <Tag icon={<ApiOutlined />} color={typeColorMap[type] || 'default'}>
          {CONNECTION_TYPES.find(t => t.value === type)?.label || type}
        </Tag>
      ),
    },
    {
      title: 'Endpoint / Details',
      key: 'details',
      width: colWidths.details,
      onHeaderCell: () => ({
        width: colWidths.details,
        onResize: handleResize('details', 150),
      }),
      render: (_: unknown, record: Connection) => {
        const cfg = record.config || {};
        const parts: string[] = [];
        if (cfg.endpoint) parts.push(String(cfg.endpoint));
        else if (cfg.base_url) parts.push(String(cfg.base_url));
        if (cfg.deployment_name) parts.push(`deployment: ${cfg.deployment_name}`);
        if (cfg.api_version) parts.push(`v${cfg.api_version}`);
        const text = parts.length > 0 ? parts.join(' | ') : null;
        return <OverflowPopover text={text} />;
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: colWidths.description,
      onHeaderCell: () => ({
        width: colWidths.description,
        onResize: handleResize('description', 100),
      }),
      render: (text: string) => <OverflowPopover text={text} />,
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
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
      <PageHeader
        title="Connections"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateForm}>
            New Connection
          </Button>
        }
      />

      <Card>
        <ListToolbar
          searchPlaceholder="Search by name or description"
          onSearch={setSearchText}
        />

        <Table<Connection>
          columns={columns}
          dataSource={filteredConnections}
          rowKey="id"
          loading={loading}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: 80 + colWidths.name + 200 + colWidths.details + colWidths.description + 160 + 200 }}
          pagination={{
            current: page,
            pageSize,
            total: filteredConnections.length !== connections.length
              ? filteredConnections.length
              : total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
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
          <Form.Item
            name="is_default"
            label="Set as Default"
            valuePropName="checked"
            tooltip="Only one default connection per type. Setting this will unset any existing default of the same type."
          >
            <Switch />
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
