import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { WorkflowRun, WorkflowRunDetail, Workflow } from '../types';
import { workflowRunsApi, workflowsApi } from '../services/api';
import { ResizableTitle, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning',
};

export default function WorkflowRunHistory() {
  const [searchParams] = useSearchParams();
  const initialWorkflowId = searchParams.get('workflow_id') || undefined;

  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowFilter, setWorkflowFilter] = useState<string | undefined>(
    initialWorkflowId,
  );
  const [searchText, setSearchText] = useState('');

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [colWidths, setColWidths] = useState({ id: 220, workflow: 200 });
  const handleResize = makeResizeHandler(setColWidths);

  useEffect(() => {
    workflowsApi
      .list(1, 100)
      .then((res) => setWorkflows(res.items))
      .catch(() => {});
  }, []);

  const fetchRuns = useCallback(
    async (p: number, ps: number) => {
      setLoading(true);
      try {
        const data = await workflowRunsApi.list(p, ps, workflowFilter);
        setRuns(data.items);
        setTotal(data.total);
      } catch {
        message.error('Failed to load workflow runs');
      } finally {
        setLoading(false);
      }
    },
    [workflowFilter],
  );

  useEffect(() => {
    fetchRuns(page, pageSize);
  }, [page, pageSize, fetchRuns]);

  const workflowNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    workflows.forEach((w) => {
      map[w.id] = w.name;
    });
    return map;
  }, [workflows]);

  const filteredRuns = useMemo(() => {
    if (!searchText) return runs;
    const lower = searchText.toLowerCase();
    return runs.filter(
      (r) =>
        r.id.toLowerCase().includes(lower) ||
        (workflowNameMap[r.workflow_id] || '')
          .toLowerCase()
          .includes(lower),
    );
  }, [runs, searchText, workflowNameMap]);

  const openDetail = async (runId: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const d = await workflowRunsApi.get(runId);
      setDetail(d);
    } catch {
      message.error('Failed to load run detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<WorkflowRun> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: colWidths.id,
      ellipsis: true,
      onHeaderCell: () => ({
        width: colWidths.id,
        onResize: handleResize('id', 120),
      }),
      render: (id: string) => (
        <a onClick={() => openDetail(id)}>{id}</a>
      ),
    },
    {
      title: 'Workflow',
      dataIndex: 'workflow_id',
      key: 'workflow_id',
      width: colWidths.workflow,
      ellipsis: true,
      onHeaderCell: () => ({
        width: colWidths.workflow,
        onResize: handleResize('workflow', 120),
      }),
      render: (id: string) => workflowNameMap[id] || id,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status]}>{status}</Tag>
      ),
    },
    {
      title: 'Files',
      key: 'files',
      width: 120,
      render: (_: unknown, record: WorkflowRun) =>
        `${record.processed_files}/${record.total_files}`,
    },
    {
      title: 'Failed',
      dataIndex: 'failed_files',
      key: 'failed_files',
      width: 80,
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 160,
      sorter: (a, b) =>
        new Date(a.started_at || 0).getTime() -
        new Date(b.started_at || 0).getTime(),
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: 'Finished',
      dataIndex: 'finished_at',
      key: 'finished_at',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
  ];

  return (
    <div>
      <PageHeader title="Workflow Run History" />
      <Card>
        <ListToolbar
          searchPlaceholder="Search by ID or workflow name"
          onSearch={setSearchText}
          filters={
            <Select
              allowClear
              placeholder="Filter by workflow"
              value={workflowFilter}
              onChange={(v) => {
                setWorkflowFilter(v);
                setPage(1);
              }}
              options={workflows.map((w) => ({
                label: w.name,
                value: w.id,
              }))}
              style={{ minWidth: 200 }}
            />
          }
        />
        <Table<WorkflowRun>
          columns={columns}
          dataSource={filteredRuns}
          rowKey="id"
          loading={loading}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{
            x:
              colWidths.id +
              colWidths.workflow +
              110 +
              120 +
              80 +
              160 +
              160,
          }}
          pagination={{
            current: page,
            pageSize,
            total:
              filteredRuns.length !== runs.length
                ? filteredRuns.length
                : total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `Total ${t} runs`,
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Workflow Run Detail"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={700}
        loading={detailLoading}
      >
        {detail && (
          <>
            <Descriptions
              column={2}
              bordered
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLOR[detail.status]}>{detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Files">
                {detail.total_files}
              </Descriptions.Item>
              <Descriptions.Item label="Processed">
                {detail.processed_files}
              </Descriptions.Item>
              <Descriptions.Item label="Failed">
                {detail.failed_files}
              </Descriptions.Item>
              <Descriptions.Item label="Workflow">
                {workflowNameMap[detail.workflow_id] || detail.workflow_id}
              </Descriptions.Item>
              {detail.error_message && (
                <Descriptions.Item label="Error" span={2}>
                  {detail.error_message}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Started At">
                {detail.started_at
                  ? new Date(detail.started_at).toLocaleString()
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Finished At">
                {detail.finished_at
                  ? new Date(detail.finished_at).toLocaleString()
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {detail.pipeline_runs.length > 0 && (
              <>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  Pipeline Runs
                </div>
                <Table
                  dataSource={detail.pipeline_runs}
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
                        <Tag color={STATUS_COLOR[s]}>{s}</Tag>
                      ),
                    },
                    {
                      title: 'Files',
                      key: 'files',
                      width: 100,
                      render: (
                        _: unknown,
                        r: { processed_files: number; total_files: number },
                      ) => `${r.processed_files}/${r.total_files}`,
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
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
