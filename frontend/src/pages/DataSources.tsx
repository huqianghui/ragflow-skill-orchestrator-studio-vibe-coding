import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { DataSource, DataSourceType } from '../types';
import { dataSourcesApi } from '../services/api';

const { Title } = Typography;

// ── Type metadata ──

interface TypeMeta {
  label: string;
  color: string;
  icon: string;
}

const TYPE_META: Record<DataSourceType, TypeMeta> = {
  local_upload: { label: 'Local Upload', color: 'default', icon: '/icons/data-sources/local-upload.svg' },
  azure_blob: { label: 'Azure Blob Storage', color: 'blue', icon: '/icons/data-sources/azure-blob-storage.svg' },
  azure_adls_gen2: { label: 'Azure Data Lake Gen2', color: 'blue', icon: '/icons/data-sources/azure-data-lake-gen2.svg' },
  azure_cosmos_db: { label: 'Azure Cosmos DB', color: 'blue', icon: '/icons/data-sources/azure-cosmos-db.svg' },
  azure_sql: { label: 'Azure SQL Database', color: 'blue', icon: '/icons/data-sources/azure-sql-database.svg' },
  azure_table: { label: 'Azure Table Storage', color: 'blue', icon: '/icons/data-sources/azure-table-storage.svg' },
  microsoft_onelake: { label: 'Microsoft OneLake', color: 'purple', icon: '/icons/data-sources/microsoft-onelake.svg' },
  sharepoint: { label: 'SharePoint', color: 'cyan', icon: '/icons/data-sources/sharepoint.svg' },
  onedrive: { label: 'OneDrive', color: 'blue', icon: '/icons/data-sources/onedrive.svg' },
  onedrive_business: { label: 'OneDrive for Business', color: 'blue', icon: '/icons/data-sources/onedrive-business.svg' },
  azure_file_storage: { label: 'Azure File Storage', color: 'blue', icon: '/icons/data-sources/azure-file-storage.svg' },
  azure_queues: { label: 'Azure Queues', color: 'gold', icon: '/icons/data-sources/azure-queues.svg' },
  service_bus: { label: 'Service Bus', color: 'gold', icon: '/icons/data-sources/service-bus.svg' },
  amazon_s3: { label: 'Amazon S3', color: 'orange', icon: '/icons/data-sources/amazon-s3.svg' },
  dropbox: { label: 'Dropbox', color: 'geekblue', icon: '/icons/data-sources/dropbox.svg' },
  sftp_ssh: { label: 'SFTP - SSH', color: 'gold', icon: '/icons/data-sources/sftp-ssh.svg' },
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ── Config fields for edit modal (simplified — reuse from DataSourceNew would be better via shared module) ──
const CONFIG_FIELDS: Record<string, Array<{ name: string; label: string; secret?: boolean; required?: boolean }>> = {
  azure_blob: [
    { name: 'connection_string', label: 'Connection String', secret: true, required: true },
    { name: 'container_name', label: 'Container Name', required: true },
    { name: 'path_prefix', label: 'Path Prefix' },
  ],
  azure_adls_gen2: [
    { name: 'account_name', label: 'Account Name', required: true },
    { name: 'account_key', label: 'Account Key', secret: true, required: true },
    { name: 'filesystem', label: 'Filesystem', required: true },
    { name: 'path_prefix', label: 'Path Prefix' },
  ],
  amazon_s3: [
    { name: 'access_key_id', label: 'Access Key ID', secret: true, required: true },
    { name: 'secret_access_key', label: 'Secret Access Key', secret: true, required: true },
    { name: 'bucket_name', label: 'Bucket Name', required: true },
    { name: 'region', label: 'Region', required: true },
    { name: 'path_prefix', label: 'Path Prefix' },
  ],
  // Other types can be added as needed; for now keep it minimal
};

export default function DataSources() {
  const navigate = useNavigate();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingDs, setEditingDs] = useState<DataSource | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const data = await dataSourcesApi.list(p, ps);
      setDataSources(data.items);
      setTotal(data.total);
    } catch {
      message.error('Failed to load data sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page, pageSize);
  }, [page, pageSize, fetchData]);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await dataSourcesApi.test(id);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } catch {
      message.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dataSourcesApi.delete(id);
      message.success('Data source deleted');
      fetchData(page, pageSize);
    } catch {
      message.error('Failed to delete data source');
    }
  };

  const openEdit = (ds: DataSource) => {
    setEditingDs(ds);
    form.setFieldsValue({
      name: ds.name,
      description: ds.description || '',
      ...ds.connection_config,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingDs) return;
    try {
      const values = await form.validateFields();
      setEditLoading(true);

      const fields = CONFIG_FIELDS[editingDs.source_type] || [];
      const config: Record<string, string> = {};
      for (const f of fields) {
        if (values[f.name]) {
          config[f.name] = values[f.name];
        }
      }

      await dataSourcesApi.update(editingDs.id, {
        name: values.name,
        description: values.description || null,
        connection_config: Object.keys(config).length > 0 ? config : undefined,
      });
      message.success('Data source updated');
      setEditOpen(false);
      fetchData(page, pageSize);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to update data source');
    } finally {
      setEditLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: DataSource) => (
        <a onClick={() => openEdit(record)}>{name}</a>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 260,
      render: (type: DataSourceType) => {
        const meta = TYPE_META[type] || { label: type, color: 'default', icon: '' };
        return (
          <Space>
            <img
              src={meta.icon}
              alt=""
              style={{ width: 20, height: 20 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <Tag color={meta.color}>{meta.label}</Tag>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = { active: 'green', inactive: 'default', error: 'red' };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    { title: 'Files', dataIndex: 'file_count', key: 'file_count', width: 80 },
    {
      title: 'Size',
      dataIndex: 'total_size',
      key: 'total_size',
      width: 100,
      render: (size: number) => formatSize(size),
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
      width: 220,
      render: (_: unknown, record: DataSource) => (
        <Space>
          <Button
            type="link"
            size="small"
            loading={testingId === record.id}
            onClick={() => handleTest(record.id)}
          >
            Test
          </Button>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this data source?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const editFields = editingDs ? (CONFIG_FIELDS[editingDs.source_type] || []) : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Data Sources</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/data-sources/new')}>
          New Data Source
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={dataSources}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} data sources`,
          }}
        />
      </Card>

      <Modal
        title="Edit Data Source"
        open={editOpen}
        onCancel={() => { setEditOpen(false); form.resetFields(); }}
        onOk={handleEditSubmit}
        confirmLoading={editLoading}
        okText="Update"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          {editingDs && (
            <Form.Item label="Type">
              <Input value={TYPE_META[editingDs.source_type]?.label || editingDs.source_type} disabled />
            </Form.Item>
          )}
          {editFields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `Please enter ${field.label}` }] : undefined}
            >
              <Input
                placeholder={field.secret ? 'Leave empty to keep current value' : `Enter ${field.label}`}
                type={field.secret ? 'password' : 'text'}
              />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}
