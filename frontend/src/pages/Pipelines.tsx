import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Form, Input, Modal, Select, Space, Table, Tag,
  Typography, message, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BugOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Pipeline, PipelineTemplate } from '../types';
import { pipelinesApi } from '../services/api';

const { Title, Paragraph } = Typography;

export default function Pipelines() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [form] = Form.useForm();

  const loadPipelines = async () => {
    setLoading(true);
    try {
      const resp = await pipelinesApi.list(1, 100);
      setPipelines(resp.items);
    } catch {
      message.error('Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPipelines(); }, []);

  const openNewModal = async () => {
    form.resetFields();
    try {
      const tpls = await pipelinesApi.getTemplates();
      setTemplates(tpls);
    } catch {
      setTemplates([]);
    }
    setModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const tpl = templates.find(t => t.name === values.template);
      const graphNodes = tpl ? tpl.nodes : [];
      await pipelinesApi.create({
        name: values.name,
        description: values.description || null,
        status: 'draft',
        graph_data: { nodes: graphNodes },
      });
      message.success('Pipeline created');
      setModalOpen(false);
      loadPipelines();
    } catch {
      // validation error — handled by form
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await pipelinesApi.delete(id);
      message.success('Pipeline deleted');
      loadPipelines();
    } catch {
      message.error('Failed to delete pipeline');
    }
  };

  const columns: ColumnsType<Pipeline> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <a onClick={() => navigate(`/pipelines/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          draft: 'default', validated: 'blue', active: 'green', archived: 'gray',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Nodes',
      key: 'nodes',
      width: 80,
      render: (_: unknown, record: Pipeline) => (record.graph_data?.nodes?.length ?? 0),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: Pipeline) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/pipelines/${record.id}`)}
          >
            Edit
          </Button>
          <Button
            size="small"
            icon={<BugOutlined />}
            onClick={() => navigate(`/pipelines/${record.id}?mode=debug`)}
          >
            Debug
          </Button>
          <Popconfirm
            title="Delete this pipeline?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Pipelines</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNewModal}>
          New Pipeline
        </Button>
      </div>
      <Card>
        <Table<Pipeline>
          columns={columns}
          dataSource={pipelines}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="New Pipeline"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="Create"
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Pipeline name is required' }]}
          >
            <Input placeholder="e.g. PDF Document Indexing" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
          <Form.Item name="template" label="Template (optional)">
            <Select allowClear placeholder="Start from scratch or pick a template">
              {templates.map(t => (
                <Select.Option key={t.name} value={t.name}>
                  <div>
                    <strong>{t.name}</strong>
                    <Paragraph
                      type="secondary"
                      style={{ margin: 0, fontSize: 12 }}
                      ellipsis
                    >
                      {t.description}
                    </Paragraph>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
