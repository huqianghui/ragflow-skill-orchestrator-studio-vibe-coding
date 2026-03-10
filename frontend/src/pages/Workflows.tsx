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
  Space,
  Table,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Workflow, WorkflowRunDetail } from '../types';
import { workflowsApi } from '../services/api';
import { ResizableTitle, OverflowPopover, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  active: 'green',
  archived: 'gray',
};

export default function Workflows() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form] = Form.useForm();

  // Run state
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<WorkflowRunDetail | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);

  // Search
  const [searchText, setSearchText] = useState('');

  // Resizable column widths
  const [colWidths, setColWidths] = useState({ name: 200, description: 250 });
  const handleResize = makeResizeHandler(setColWidths);

  const fetchWorkflows = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const data = await workflowsApi.list(p, ps);
      setWorkflows(data.items);
      setTotal(data.total);
    } catch {
      message.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows(page, pageSize);
  }, [page, pageSize, fetchWorkflows]);

  // Client-side search filter
  const filteredWorkflows = useMemo(() => {
    if (!searchText) return workflows;
    const lower = searchText.toLowerCase();
    return workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(lower) ||
        (w.description && w.description.toLowerCase().includes(lower)),
    );
  }, [workflows, searchText]);

  const handleDelete = async (id: string) => {
    try {
      await workflowsApi.delete(id);
      message.success('Workflow deleted');
      fetchWorkflows(page, pageSize);
    } catch {
      message.error('Failed to delete workflow');
    }
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      const result = await workflowsApi.run(id);
      setRunResult(result);
      setRunModalOpen(true);
      if (result.status === 'completed') {
        message.success(`Workflow completed: ${result.processed_files} files processed`);
      } else if (result.status === 'failed') {
        message.error(`Workflow failed: ${result.error_message || 'Unknown error'}`);
      }
    } catch {
      message.error('Failed to run workflow');
    } finally {
      setRunningId(null);
    }
  };

  const openCreateForm = () => {
    form.resetFields();
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setFormLoading(true);

      const payload = {
        name: values.name,
        description: values.description || null,
      };

      const created = await workflowsApi.create(payload);
      message.success('Workflow created');
      setFormOpen(false);
      form.resetFields();
      navigate(`/workflows/${created.id}/edit`);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to create workflow');
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ColumnsType<Workflow> = [
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
      render: (name: string, record: Workflow) => (
        <a onClick={() => navigate(`/workflows/${record.id}/edit`)}>
          <OverflowPopover text={name} />
        </a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Data Sources',
      key: 'data_sources',
      width: 120,
      render: (_: unknown, record: Workflow) => record.data_source_ids.length,
    },
    {
      title: 'Routes',
      key: 'routes',
      width: 100,
      render: (_: unknown, record: Workflow) => record.routes.length,
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
      sorter: (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 300,
      render: (_: unknown, record: Workflow) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={runningId === record.id}
            onClick={() => handleRun(record.id)}
          >
            Run
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() =>
              navigate(`/workflow-runs?workflow_id=${record.id}`)
            }
          >
            Runs
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/workflows/${record.id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this workflow?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
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
        title="Workflows"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateForm}>
            New Workflow
          </Button>
        }
      />

      <Card>
        <ListToolbar
          searchPlaceholder="Search by name or description"
          onSearch={setSearchText}
        />

        <Table<Workflow>
          columns={columns}
          dataSource={filteredWorkflows}
          rowKey="id"
          loading={loading}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{
            x:
              colWidths.name +
              100 +
              120 +
              100 +
              colWidths.description +
              160 +
              300,
          }}
          pagination={{
            current: page,
            pageSize,
            total:
              filteredWorkflows.length !== workflows.length
                ? filteredWorkflows.length
                : total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `Total ${t} workflows`,
          }}
        />
      </Card>

      <Modal
        title="New Workflow"
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          form.resetFields();
        }}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        okText="Create"
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, message: 'Please enter workflow name' },
            ]}
          >
            <Input placeholder="e.g. HR Training Materials Processing" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Run Result Modal */}
      <Modal
        title="Workflow Run Result"
        open={runModalOpen}
        onCancel={() => setRunModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setRunModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={700}
      >
        {runResult && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Status">
                <Tag
                  color={
                    runResult.status === 'completed'
                      ? 'success'
                      : runResult.status === 'failed'
                        ? 'error'
                        : 'processing'
                  }
                >
                  {runResult.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Files">
                {runResult.total_files}
              </Descriptions.Item>
              <Descriptions.Item label="Processed">
                {runResult.processed_files}
              </Descriptions.Item>
              <Descriptions.Item label="Failed">
                {runResult.failed_files}
              </Descriptions.Item>
              {runResult.error_message && (
                <Descriptions.Item label="Error" span={2}>
                  {runResult.error_message}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Started At">
                {runResult.started_at ? new Date(runResult.started_at).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Finished At">
                {runResult.finished_at ? new Date(runResult.finished_at).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>

            {runResult.pipeline_runs.length > 0 && (
              <Table
                dataSource={runResult.pipeline_runs}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: 'Route',
                    dataIndex: 'route_name',
                    key: 'route_name',
                    width: 150,
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 100,
                    render: (s: string) => (
                      <Tag
                        color={
                          s === 'completed'
                            ? 'success'
                            : s === 'failed'
                              ? 'error'
                              : 'processing'
                        }
                      >
                        {s}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Files',
                    key: 'files',
                    width: 120,
                    render: (_: unknown, r: { processed_files: number; total_files: number }) =>
                      `${r.processed_files}/${r.total_files}`,
                  },
                  {
                    title: 'Error',
                    dataIndex: 'error_message',
                    key: 'error_message',
                    ellipsis: true,
                    render: (msg: string | null) => msg || '-',
                  },
                ]}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
