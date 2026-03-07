import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Form, Input, Modal, Select, Space, Table, Tag,
  Typography, message, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BugOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Pipeline, PipelineTemplate } from '../types';
import { pipelinesApi } from '../services/api';
import { ResizableTitle, OverflowPopover, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';

const { Paragraph } = Typography;

export default function Pipelines() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [form] = Form.useForm();

  // Search
  const [searchText, setSearchText] = useState('');

  // Resizable column widths
  const [colWidths, setColWidths] = useState({ name: 160, description: 300 });
  const handleResize = makeResizeHandler(setColWidths);

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

  // Client-side search filter
  const filteredPipelines = useMemo(() => {
    if (!searchText) return pipelines;
    const lower = searchText.toLowerCase();
    return pipelines.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.description && p.description.toLowerCase().includes(lower)),
    );
  }, [pipelines, searchText]);

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
      width: colWidths.name,
      sorter: (a, b) => a.name.localeCompare(b.name),
      onHeaderCell: () => ({
        width: colWidths.name,
        onResize: handleResize('name', 100),
      }),
      render: (name: string, record) => (
        <a onClick={() => navigate(`/pipelines/${record.id}`)}>
          <OverflowPopover text={name} />
        </a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      sorter: (a, b) => a.status.localeCompare(b.status),
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
      sorter: (a, b) =>
        (a.graph_data?.nodes?.length ?? 0) - (b.graph_data?.nodes?.length ?? 0),
      render: (_: unknown, record: Pipeline) => (record.graph_data?.nodes?.length ?? 0),
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
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
      <PageHeader
        title="Pipelines"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openNewModal}>
            New Pipeline
          </Button>
        }
      />
      <Card>
        <ListToolbar
          searchPlaceholder="Search by name or description"
          onSearch={setSearchText}
        />

        <Table<Pipeline>
          columns={columns}
          dataSource={filteredPipelines}
          rowKey="id"
          loading={loading}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: colWidths.name + 110 + 80 + colWidths.description + 160 + 200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `Total ${t} pipelines`,
          }}
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
