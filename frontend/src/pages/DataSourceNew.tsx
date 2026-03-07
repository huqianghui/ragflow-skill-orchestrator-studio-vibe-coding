import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Progress,
  Row,
  Typography,
  Upload,
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import type { DataSourceType } from '../types';
import { dataSourcesApi } from '../services/api';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ── Source type definitions ──

interface ConfigField {
  name: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}

interface SourceTypeDef {
  value: DataSourceType;
  label: string;
  category: 'local' | 'builtin_indexer' | 'logic_apps_connector';
  categoryLabel: string;
  icon: string;
  configFields: ConfigField[];
}

const SOURCE_TYPES: SourceTypeDef[] = [
  {
    value: 'local_upload',
    label: 'Local File Upload',
    category: 'local',
    categoryLabel: 'Local',
    icon: '/icons/data-sources/local-upload.svg',
    configFields: [],
  },
  {
    value: 'azure_blob',
    label: 'Azure Blob Storage',
    category: 'builtin_indexer',
    categoryLabel: 'Built-in indexer',
    icon: '/icons/data-sources/azure-blob-storage.svg',
    configFields: [
      { name: 'connection_string', label: 'Connection String', secret: true, required: true },
      { name: 'container_name', label: 'Container Name', required: true },
      { name: 'path_prefix', label: 'Path Prefix' },
    ],
  },
  {
    value: 'azure_adls_gen2',
    label: 'Azure Data Lake Storage Gen2',
    category: 'builtin_indexer',
    categoryLabel: 'Built-in indexer',
    icon: '/icons/data-sources/azure-data-lake-gen2.svg',
    configFields: [
      { name: 'account_name', label: 'Account Name', required: true },
      { name: 'account_key', label: 'Account Key', secret: true, required: true },
      { name: 'filesystem', label: 'Filesystem', required: true },
      { name: 'path_prefix', label: 'Path Prefix' },
    ],
  },
  {
    value: 'azure_cosmos_db',
    label: 'Azure Cosmos DB',
    category: 'builtin_indexer',
    categoryLabel: 'Built-in indexer',
    icon: '/icons/data-sources/azure-cosmos-db.svg',
    configFields: [
      { name: 'connection_string', label: 'Connection String', secret: true, required: true },
      { name: 'database', label: 'Database', required: true },
      { name: 'container', label: 'Container', required: true },
      { name: 'query', label: 'Query', placeholder: 'Optional SQL query' },
    ],
  },
  {
    value: 'azure_sql',
    label: 'Azure SQL Database',
    category: 'builtin_indexer',
    categoryLabel: 'Built-in indexer',
    icon: '/icons/data-sources/azure-sql-database.svg',
    configFields: [
      { name: 'connection_string', label: 'Connection String', secret: true, required: true },
      { name: 'table_or_view', label: 'Table or View', required: true },
      { name: 'query', label: 'Query', placeholder: 'Optional SQL query' },
    ],
  },
  {
    value: 'azure_table',
    label: 'Azure Table Storage',
    category: 'builtin_indexer',
    categoryLabel: 'Built-in indexer',
    icon: '/icons/data-sources/azure-table-storage.svg',
    configFields: [
      { name: 'connection_string', label: 'Connection String', secret: true, required: true },
      { name: 'table_name', label: 'Table Name', required: true },
    ],
  },
  {
    value: 'microsoft_onelake',
    label: 'Microsoft OneLake',
    category: 'builtin_indexer',
    categoryLabel: 'Built-in indexer',
    icon: '/icons/data-sources/microsoft-onelake.svg',
    configFields: [
      { name: 'tenant_id', label: 'Tenant ID', required: true },
      { name: 'client_id', label: 'Client ID', required: true },
      { name: 'client_secret', label: 'Client Secret', secret: true, required: true },
      { name: 'workspace_id', label: 'Workspace ID', required: true },
      { name: 'lakehouse_id', label: 'Lakehouse ID', required: true },
      { name: 'path_prefix', label: 'Path Prefix' },
    ],
  },
  {
    value: 'sharepoint',
    label: 'SharePoint',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/sharepoint.svg',
    configFields: [
      { name: 'site_url', label: 'Site URL', required: true },
      { name: 'tenant_id', label: 'Tenant ID', required: true },
      { name: 'client_id', label: 'Client ID', required: true },
      { name: 'client_secret', label: 'Client Secret', secret: true, required: true },
      { name: 'document_library', label: 'Document Library' },
      { name: 'folder_path', label: 'Folder Path' },
    ],
  },
  {
    value: 'onedrive',
    label: 'OneDrive',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/onedrive.svg',
    configFields: [
      { name: 'tenant_id', label: 'Tenant ID', required: true },
      { name: 'client_id', label: 'Client ID', required: true },
      { name: 'client_secret', label: 'Client Secret', secret: true, required: true },
      { name: 'drive_id', label: 'Drive ID' },
      { name: 'folder_path', label: 'Folder Path' },
    ],
  },
  {
    value: 'onedrive_business',
    label: 'OneDrive for Business',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/onedrive-business.svg',
    configFields: [
      { name: 'tenant_id', label: 'Tenant ID', required: true },
      { name: 'client_id', label: 'Client ID', required: true },
      { name: 'client_secret', label: 'Client Secret', secret: true, required: true },
      { name: 'user_email', label: 'User Email', required: true },
      { name: 'folder_path', label: 'Folder Path' },
    ],
  },
  {
    value: 'azure_file_storage',
    label: 'Azure File Storage',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/azure-file-storage.svg',
    configFields: [
      { name: 'connection_string', label: 'Connection String', secret: true, required: true },
      { name: 'share_name', label: 'Share Name', required: true },
      { name: 'directory_path', label: 'Directory Path' },
    ],
  },
  {
    value: 'azure_queues',
    label: 'Azure Queues',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/azure-queues.svg',
    configFields: [
      { name: 'connection_string', label: 'Connection String', secret: true, required: true },
      { name: 'queue_name', label: 'Queue Name', required: true },
    ],
  },
  {
    value: 'service_bus',
    label: 'Service Bus',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/service-bus.svg',
    configFields: [
      { name: 'connection_string', label: 'Connection String', secret: true, required: true },
      { name: 'queue_or_topic', label: 'Queue or Topic', required: true },
      { name: 'subscription', label: 'Subscription' },
    ],
  },
  {
    value: 'amazon_s3',
    label: 'Amazon S3',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/amazon-s3.svg',
    configFields: [
      { name: 'access_key_id', label: 'Access Key ID', secret: true, required: true },
      { name: 'secret_access_key', label: 'Secret Access Key', secret: true, required: true },
      { name: 'bucket_name', label: 'Bucket Name', required: true },
      { name: 'region', label: 'Region', required: true, placeholder: 'e.g. us-east-1' },
      { name: 'path_prefix', label: 'Path Prefix' },
    ],
  },
  {
    value: 'dropbox',
    label: 'Dropbox',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/dropbox.svg',
    configFields: [
      { name: 'access_token', label: 'Access Token', secret: true, required: true },
      { name: 'folder_path', label: 'Folder Path' },
    ],
  },
  {
    value: 'sftp_ssh',
    label: 'SFTP - SSH',
    category: 'logic_apps_connector',
    categoryLabel: 'Logic Apps connector',
    icon: '/icons/data-sources/sftp-ssh.svg',
    configFields: [
      { name: 'host', label: 'Host', required: true },
      { name: 'port', label: 'Port', defaultValue: '22' },
      { name: 'username', label: 'Username', required: true },
      { name: 'auth_method', label: 'Auth Method', required: true, placeholder: 'password or private_key' },
      { name: 'password', label: 'Password', secret: true },
      { name: 'private_key', label: 'Private Key', secret: true },
      { name: 'remote_path', label: 'Remote Path', required: true },
    ],
  },
];

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'local', label: 'Local' },
  { key: 'builtin_indexer', label: 'Built-in indexer' },
  { key: 'logic_apps_connector', label: 'Logic Apps connector' },
];

const ACCEPTED_FILES = '.pdf,.docx,.doc,.txt,.md,.csv,.html,.png,.jpg,.jpeg,.tiff,.json,.jsonl,.xlsx,.xls';

export default function DataSourceNew() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState<SourceTypeDef | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [form] = Form.useForm();
  const [quotaInfo, setQuotaInfo] = useState<{ used_mb: number; total_mb: number } | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const fetchQuota = useCallback(async () => {
    try {
      const info = await dataSourcesApi.getQuota();
      setQuotaInfo({ used_mb: info.used_mb, total_mb: info.total_mb });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const filtered = SOURCE_TYPES.filter(
    (t) => t.label.toLowerCase().includes(filter.toLowerCase())
  );

  const handleCardClick = (typeDef: SourceTypeDef) => {
    setSelectedType(typeDef);
    form.resetFields();
    setUploadFiles([]);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setFormLoading(true);

      const config: Record<string, string> = {};
      if (selectedType) {
        for (const f of selectedType.configFields) {
          if (values[f.name]) {
            config[f.name] = values[f.name];
          }
        }
      }

      const ds = await dataSourcesApi.create({
        name: values.name,
        description: values.description || null,
        source_type: selectedType?.value,
        connection_config: config,
      });

      // If local_upload with files, upload them
      if (selectedType?.value === 'local_upload' && uploadFiles.length > 0) {
        for (const file of uploadFiles) {
          try {
            await dataSourcesApi.upload(ds.id, file);
          } catch {
            message.warning(`Failed to upload ${file.name}`);
          }
        }
      }

      message.success('Data source created');
      setModalOpen(false);
      navigate('/data-sources');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to create data source');
    } finally {
      setFormLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTestLoading(true);

      const config: Record<string, string> = {};
      if (selectedType) {
        for (const f of selectedType.configFields) {
          if (values[f.name]) {
            config[f.name] = values[f.name];
          }
        }
      }

      // Create, test, then offer to keep or delete
      const ds = await dataSourcesApi.create({
        name: values.name || `test-${Date.now()}`,
        description: values.description || null,
        source_type: selectedType?.value,
        connection_config: config,
      });

      const result = await dataSourcesApi.test(ds.id);
      if (result.success) {
        message.success(result.message);
        // Navigate to list since we already created it
        setModalOpen(false);
        navigate('/data-sources');
      } else {
        message.error(result.message);
        // Delete the test data source
        await dataSourcesApi.delete(ds.id);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const isLocalUpload = selectedType?.value === 'local_upload';

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/data-sources')}
        style={{ padding: 0, marginBottom: 16 }}
      >
        Back to Data Sources
      </Button>

      <Title level={3}>Choose a data source</Title>
      <Text type="secondary">Select a data source type to configure.</Text>

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
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{t.label}</div>
                      <div style={{ color: '#999', fontSize: 12 }}>{t.categoryLabel}</div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        );
      })}

      <Modal
        title={isLocalUpload ? 'Local File Upload' : `Configure ${selectedType?.label || ''}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={[
          <Button key="cancel" onClick={() => { setModalOpen(false); form.resetFields(); }}>
            Cancel
          </Button>,
          !isLocalUpload && (
            <Button key="test" loading={testLoading} onClick={handleTest}>
              Test
            </Button>
          ),
          <Button key="create" type="primary" loading={formLoading} onClick={handleCreate}>
            {isLocalUpload ? 'Upload & Create' : 'Create'}
          </Button>,
        ]}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g. my-azure-blob" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>

          {!isLocalUpload && selectedType && (
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

          {isLocalUpload && (
            <>
              <div style={{ borderTop: '1px solid #f0f0f0', margin: '16px 0 12px', paddingTop: 12 }}>
                <Text strong>Files</Text>
              </div>
              <Dragger
                multiple
                accept={ACCEPTED_FILES}
                beforeUpload={(file) => {
                  setUploadFiles((prev) => [...prev, file]);
                  return false; // prevent auto upload
                }}
                onRemove={(file) => {
                  setUploadFiles((prev) => prev.filter((f) => f.name !== file.name));
                }}
                fileList={uploadFiles.map((f) => ({
                  uid: f.name,
                  name: f.name,
                  size: f.size,
                  type: f.type,
                  status: 'done' as const,
                }))}
              >
                <p style={{ fontSize: 32, color: '#999' }}>+</p>
                <p>Drag files here or click to browse</p>
                <p style={{ color: '#999', fontSize: 12 }}>
                  PDF, DOCX, TXT, MD, CSV, HTML, PNG, JPG, TIFF, JSON, JSONL, XLSX
                </p>
              </Dragger>
              {quotaInfo && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    {quotaInfo.used_mb} MB / {quotaInfo.total_mb} MB used
                  </Text>
                  <Progress
                    percent={Math.round((quotaInfo.used_mb / quotaInfo.total_mb) * 100)}
                    strokeColor={
                      quotaInfo.used_mb / quotaInfo.total_mb > 0.9
                        ? '#ff4d4f'
                        : quotaInfo.used_mb / quotaInfo.total_mb > 0.7
                          ? '#faad14'
                          : '#52c41a'
                    }
                    size="small"
                  />
                </div>
              )}
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
