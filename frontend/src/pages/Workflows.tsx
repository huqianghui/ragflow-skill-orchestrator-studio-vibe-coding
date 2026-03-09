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
  Table,
  Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Workflow, Pipeline, DataSource, Target, RouteRule } from '../types';
import { workflowsApi, pipelinesApi, dataSourcesApi, targetsApi } from '../services/api';
import { ResizableTitle, OverflowPopover, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  active: 'green',
  archived: 'gray',
};

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [form] = Form.useForm();

  // Lookups for pipelines, data sources, targets
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);

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

  const fetchLookups = useCallback(async () => {
    try {
      const [pipResp, dsResp, tgtResp] = await Promise.all([
        pipelinesApi.list(1, 100),
        dataSourcesApi.list(1, 100),
        targetsApi.list(1, 100),
      ]);
      setPipelines(pipResp.items);
      setDataSources(dsResp.items);
      setTargets(tgtResp.items);
    } catch {
      // Silently ignore — lookups are optional
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

  const openCreateForm = () => {
    setEditingWorkflow(null);
    form.resetFields();
    fetchLookups();
    setFormOpen(true);
  };

  const openEditForm = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    fetchLookups();
    form.setFieldsValue({
      name: workflow.name,
      description: workflow.description || '',
      status: workflow.status,
      data_source_ids: workflow.data_source_ids,
      routes: workflow.routes.map((r: RouteRule) => ({
        name: r.name,
        priority: r.priority,
        extensions: r.file_filter?.extensions?.join(', ') || '',
        pipeline_id: r.pipeline_id,
        target_ids: r.target_ids,
      })),
      default_pipeline_id: workflow.default_route?.pipeline_id,
      default_target_ids: workflow.default_route?.target_ids,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setFormLoading(true);

      // Build routes from form values
      const routes: RouteRule[] = (values.routes || []).map(
        (r: { name: string; priority?: number; extensions?: string; pipeline_id: string; target_ids?: string[] }, idx: number) => ({
          name: r.name,
          priority: r.priority ?? idx,
          file_filter: {
            extensions: r.extensions
              ? r.extensions.split(',').map((e: string) => e.trim()).filter(Boolean)
              : [],
          },
          pipeline_id: r.pipeline_id,
          target_ids: r.target_ids || [],
        }),
      );

      const defaultRoute = values.default_pipeline_id
        ? {
            name: 'default',
            pipeline_id: values.default_pipeline_id,
            target_ids: values.default_target_ids || [],
          }
        : null;

      const payload = {
        name: values.name,
        description: values.description || null,
        status: values.status || 'draft',
        data_source_ids: values.data_source_ids || [],
        routes,
        default_route: defaultRoute,
      };

      if (editingWorkflow) {
        await workflowsApi.update(editingWorkflow.id, payload);
        message.success('Workflow updated');
      } else {
        await workflowsApi.create(payload);
        message.success('Workflow created');
      }

      setFormOpen(false);
      form.resetFields();
      fetchWorkflows(page, pageSize);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to save workflow');
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
        <a onClick={() => openEditForm(record)}>
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
      width: 160,
      render: (_: unknown, record: Workflow) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditForm(record)}
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
              160,
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
        title={editingWorkflow ? 'Edit Workflow' : 'New Workflow'}
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          form.resetFields();
        }}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        okText={editingWorkflow ? 'Update' : 'Create'}
        destroyOnClose
        width={720}
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
          {editingWorkflow && (
            <Form.Item name="status" label="Status">
              <Select>
                <Select.Option value="draft">Draft</Select.Option>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="archived">Archived</Select.Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item name="data_source_ids" label="Data Sources">
            <Select
              mode="multiple"
              placeholder="Select data sources"
              options={dataSources.map((ds) => ({
                label: ds.name,
                value: ds.id,
              }))}
            />
          </Form.Item>

          <Form.List name="routes">
            {(fields, { add, remove }) => (
              <>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  Routes
                </div>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 12 }}
                    extra={
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={() => remove(name)}
                      >
                        Remove
                      </Button>
                    }
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'name']}
                      label="Route Name"
                      rules={[{ required: true, message: 'Route name required' }]}
                    >
                      <Input placeholder="e.g. PDF Processing" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'extensions']}
                      label="File Extensions (comma-separated)"
                    >
                      <Input placeholder="e.g. pdf, docx, xlsx" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'pipeline_id']}
                      label="Pipeline"
                      rules={[{ required: true, message: 'Pipeline required' }]}
                    >
                      <Select
                        placeholder="Select pipeline"
                        options={pipelines.map((p) => ({
                          label: p.name,
                          value: p.id,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'target_ids']}
                      label="Targets"
                    >
                      <Select
                        mode="multiple"
                        placeholder="Select targets"
                        options={targets.map((t) => ({
                          label: t.name,
                          value: t.id,
                        }))}
                      />
                    </Form.Item>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  block
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  style={{ marginBottom: 16 }}
                >
                  Add Route
                </Button>
              </>
            )}
          </Form.List>

          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            Default Route (fallback)
          </div>
          <Form.Item name="default_pipeline_id" label="Default Pipeline">
            <Select
              allowClear
              placeholder="Select default pipeline (optional)"
              options={pipelines.map((p) => ({
                label: p.name,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="default_target_ids" label="Default Targets">
            <Select
              mode="multiple"
              placeholder="Select default targets (optional)"
              options={targets.map((t) => ({
                label: t.name,
                value: t.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
