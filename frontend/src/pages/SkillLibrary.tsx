import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
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
import {
  ApiOutlined,
  BranchesOutlined,
  CodeOutlined,
  EyeInvisibleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  ForkOutlined,
  FunctionOutlined,
  GlobalOutlined,
  HighlightOutlined,
  MergeCellsOutlined,
  PictureOutlined,
  PlusOutlined,
  RobotOutlined,
  ScanOutlined,
  ScissorOutlined,
  SettingOutlined,
  SmileOutlined,
  TagsOutlined,
  ToolOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Skill } from '../types';
import { skillsApi } from '../services/api';
import { ResizableTitle, OverflowPopover, makeResizeHandler } from '../components/TableUtils';

const { Title } = Typography;
const { TextArea } = Input;

const SKILL_TYPE_OPTIONS = [
  { label: 'Web API', value: 'web_api' },
  { label: 'Config Template', value: 'config_template' },
  { label: 'Python Code', value: 'python_code' },
];

const typeIconMap: Record<string, React.ReactNode> = {
  builtin: <ToolOutlined />,
  web_api: <ApiOutlined />,
  config_template: <SettingOutlined />,
  python_code: <CodeOutlined />,
};

const skillNameIconMap: Record<string, React.ReactNode> = {
  DocumentCracker: <FileSearchOutlined />,
  TextSplitter: <ScissorOutlined />,
  TextMerger: <MergeCellsOutlined />,
  LanguageDetector: <GlobalOutlined />,
  EntityRecognizer: <TagsOutlined />,
  EntityLinker: <BranchesOutlined />,
  KeyPhraseExtractor: <HighlightOutlined />,
  SentimentAnalyzer: <SmileOutlined />,
  PIIDetector: <EyeInvisibleOutlined />,
  TextTranslator: <TranslationOutlined />,
  OCR: <ScanOutlined />,
  ImageAnalyzer: <PictureOutlined />,
  TextEmbedder: <RobotOutlined />,
  Shaper: <FunctionOutlined />,
  Conditional: <ForkOutlined />,
  GenAIPrompt: <RobotOutlined />,
};

function getSkillIcon(skill: { name: string; skill_type: string }): React.ReactNode {
  return skillNameIconMap[skill.name] || typeIconMap[skill.skill_type] || <FileTextOutlined />;
}

const typeColorMap: Record<string, string> = {
  builtin: 'blue',
  web_api: 'green',
  config_template: 'orange',
  python_code: 'purple',
};

export default function SkillLibrary() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Column widths for resizable columns
  const [colWidths, setColWidths] = useState({ name: 160, description: 350 });

  // Search & filter
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  // Detail modal
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchSkills = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const data = await skillsApi.list(p, ps);
      setSkills(data.items);
      setTotal(data.total);
    } catch {
      message.error('Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills(page, pageSize);
  }, [page, pageSize, fetchSkills]);

  // Filtered data
  const filteredSkills = useMemo(() => {
    let result = skills;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(lower) ||
          (s.description && s.description.toLowerCase().includes(lower)),
      );
    }
    if (typeFilter.length > 0) {
      result = result.filter((s) => typeFilter.includes(s.skill_type));
    }
    return result;
  }, [skills, searchText, typeFilter]);

  const handleDelete = async (id: string) => {
    try {
      await skillsApi.delete(id);
      message.success('Skill deleted');
      fetchSkills(page, pageSize);
    } catch {
      message.error('Failed to delete skill');
    }
  };

  const openCreateForm = () => {
    setEditingSkill(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEditForm = (skill: Skill) => {
    setEditingSkill(skill);
    form.setFieldsValue({
      name: skill.name,
      description: skill.description || '',
      skill_type: skill.skill_type,
      config_schema: JSON.stringify(skill.config_schema, null, 2),
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setFormLoading(true);

      const basePayload = {
        description: values.description || null,
        skill_type: values.skill_type,
        config_schema: values.config_schema ? JSON.parse(values.config_schema) : {},
      };

      if (editingSkill) {
        await skillsApi.update(editingSkill.id, basePayload);
        message.success('Skill updated');
      } else {
        const payload = { ...basePayload, name: values.name };
        if (values.skill_type === 'python_code') {
          // For python_code, create then redirect to editor
          const created = await skillsApi.create(payload);
          message.success('Skill created');
          setFormOpen(false);
          form.resetFields();
          navigate(`/skills/${created.id}/edit`);
          return;
        }
        await skillsApi.create(payload);
        message.success('Skill created');
      }

      setFormOpen(false);
      form.resetFields();
      fetchSkills(page, pageSize);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // form validation error
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 409) {
        message.error(axiosErr.response.data?.message || 'Skill name already exists');
      } else {
        message.error('Failed to save skill');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleResize = makeResizeHandler(setColWidths);

  const columns: ColumnsType<Skill> = [
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
      render: (name: string, record) => (
        <Space>
          <span style={{ fontSize: 16 }}>{getSkillIcon(record)}</span>
          <a
            onClick={() => {
              if (record.is_builtin) {
                navigate(`/skills/${record.id}/configure`);
              } else if (record.skill_type === 'python_code') {
                navigate(`/skills/${record.id}/edit`);
              } else {
                openEditForm(record);
              }
            }}
          >
            {name}
          </a>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'skill_type',
      key: 'skill_type',
      width: 100,
      sorter: (a, b) => a.skill_type.localeCompare(b.skill_type),
      render: (type: string) => (
        <Tag icon={typeIconMap[type]} color={typeColorMap[type] || 'default'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: colWidths.description,
      onHeaderCell: () => ({
        width: colWidths.description,
        onResize: handleResize('description', 150),
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
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => setDetailSkill(record)}>
            View
          </Button>
          {record.is_builtin ? (
            <Button
              type="link"
              size="small"
              onClick={() => navigate(`/skills/${record.id}/configure`)}
            >
              Configure
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => {
                if (record.skill_type === 'python_code') {
                  navigate(`/skills/${record.id}/edit`);
                } else {
                  openEditForm(record);
                }
              }}
            >
              Edit
            </Button>
          )}
          <Popconfirm
            title={
              record.is_builtin
                ? 'This is a built-in skill. It will be re-created on next application restart. Continue?'
                : 'Are you sure you want to delete this skill?'
            }
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Skill Library
        </Title>
        <Space>
          <Button type="primary" icon={<CodeOutlined />} onClick={() => navigate('/skills/new')}>
            New Python Skill
          </Button>
          <Button icon={<PlusOutlined />} onClick={openCreateForm}>
            New Skill
          </Button>
        </Space>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search
            placeholder="Search by name or description"
            allowClear
            onSearch={setSearchText}
            onChange={(e) => !e.target.value && setSearchText('')}
            style={{ width: 300 }}
          />
          <Select
            mode="multiple"
            placeholder="Filter by type"
            allowClear
            options={[
              { label: 'Built-in', value: 'builtin' },
              ...SKILL_TYPE_OPTIONS,
            ]}
            onChange={setTypeFilter}
            style={{ minWidth: 200 }}
          />
        </Space>

        <Table<Skill>
          columns={columns}
          dataSource={filteredSkills}
          rowKey="id"
          loading={loading}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: colWidths.name + 100 + colWidths.description + 160 + 180 }}
          pagination={{
            current: page,
            pageSize,
            total: filteredSkills.length !== skills.length ? filteredSkills.length : total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `Total ${t} skills`,
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Skill Details"
        open={!!detailSkill}
        onCancel={() => setDetailSkill(null)}
        footer={null}
        width={640}
      >
        {detailSkill && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Name">{detailSkill.name}</Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag icon={typeIconMap[detailSkill.skill_type]} color={typeColorMap[detailSkill.skill_type]}>
                {detailSkill.skill_type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Description">
              {detailSkill.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Built-in">
              {detailSkill.is_builtin ? <Tag color="blue">Yes</Tag> : <Tag>No</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Config Schema">
              <pre style={{ margin: 0, maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(detailSkill.config_schema, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="Created At">
              {new Date(detailSkill.created_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {new Date(detailSkill.updated_at).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Create/Edit Form Modal */}
      <Modal
        title={editingSkill ? 'Edit Skill' : 'New Skill'}
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          form.resetFields();
        }}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        okText={editingSkill ? 'Update' : 'Create'}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter skill name' }]}
          >
            <Input placeholder="Enter skill name" disabled={!!editingSkill} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Enter skill description" />
          </Form.Item>
          <Form.Item
            name="skill_type"
            label="Type"
            rules={[{ required: true, message: 'Please select skill type' }]}
          >
            <Select placeholder="Select type" options={SKILL_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="config_schema"
            label="Config Schema (JSON)"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('Invalid JSON format'));
                  }
                },
              },
            ]}
          >
            <TextArea rows={6} placeholder='{"type": "object", "properties": {}}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
