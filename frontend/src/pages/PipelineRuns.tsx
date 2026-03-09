import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Descriptions, Modal, Select, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UnifiedPipelineRun } from '../types';
import { pipelineRunsApi } from '../services/api';
import { ResizableTitle, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';
import { formatLocalDateTime } from '../utils/time';

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const SOURCE_OPTIONS = [
  { label: 'All Sources', value: '' },
  { label: 'Standalone', value: 'standalone' },
  { label: 'Workflow', value: 'workflow' },
];

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning',
};

export default function PipelineRuns() {
  const [runs, setRuns] = useState<UnifiedPipelineRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [detailRun, setDetailRun] = useState<UnifiedPipelineRun | null>(null);

  const [colWidths, setColWidths] = useState({ pipeline: 200 });
  const handleResize = makeResizeHandler(setColWidths);

  const fetchRuns = useCallback(async (p: number, ps: number, src: string) => {
    setLoading(true);
    try {
      const data = await pipelineRunsApi.list(p, ps, src || undefined);
      setRuns(data.items);
      setTotal(data.total);
    } catch {
      message.error('Failed to load pipeline runs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns(page, pageSize, sourceFilter);
  }, [page, pageSize, sourceFilter, fetchRuns]);

  const filteredRuns = useMemo(() => {
    let result = runs;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(lower) ||
          (r.pipeline_name || '').toLowerCase().includes(lower),
      );
    }
    if (statusFilter.length > 0) {
      result = result.filter((r) => statusFilter.includes(r.status));
    }
    return result;
  }, [runs, searchText, statusFilter]);

  const columns: ColumnsType<UnifiedPipelineRun> = [
    {
      title: 'Pipeline',
      dataIndex: 'pipeline_name',
      key: 'pipeline_name',
      width: colWidths.pipeline,
      ellipsis: true,
      render: (name: string | null, record) => name || record.pipeline_id,
      onHeaderCell: () => ({
        width: colWidths.pipeline,
        onResize: handleResize('pipeline', 120),
      }),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 110,
      render: (source: string) => (
        <Tag color={source === 'workflow' ? 'blue' : 'cyan'}>
          {source === 'workflow' ? 'Workflow' : 'Standalone'}
        </Tag>
      ),
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
      render: (_, record) => `${record.processed_files}/${record.total_files}`,
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      sorter: (a, b) =>
        new Date(a.started_at || 0).getTime() -
        new Date(b.started_at || 0).getTime(),
      render: (v: string | null) => (v ? formatLocalDateTime(v) : '-'),
    },
  ];

  return (
    <div>
      <PageHeader title="Pipeline Runs" />
      <Card>
        <ListToolbar
          searchPlaceholder="Search by pipeline name"
          onSearch={setSearchText}
          filters={
            <>
              <Select
                options={SOURCE_OPTIONS}
                value={sourceFilter}
                onChange={(v) => { setSourceFilter(v); setPage(1); }}
                style={{ minWidth: 140 }}
              />
              <Select
                mode="multiple"
                placeholder="Filter by status"
                allowClear
                options={STATUS_OPTIONS}
                onChange={setStatusFilter}
                style={{ minWidth: 200 }}
              />
            </>
          }
        />
        <Table<UnifiedPipelineRun>
          columns={columns}
          dataSource={filteredRuns}
          rowKey="id"
          loading={loading}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: colWidths.pipeline + 110 + 110 + 120 + 180 }}
          onRow={(record) => ({
            onClick: () => setDetailRun(record),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize,
            total: filteredRuns.length !== runs.length ? filteredRuns.length : total,
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

      <Modal
        title="Pipeline Run Detail"
        open={!!detailRun}
        onCancel={() => setDetailRun(null)}
        footer={null}
        width={640}
      >
        {detailRun && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detailRun.id}</Descriptions.Item>
            <Descriptions.Item label="Pipeline">
              {detailRun.pipeline_name || detailRun.pipeline_id}
            </Descriptions.Item>
            <Descriptions.Item label="Source">
              <Tag color={detailRun.source === 'workflow' ? 'blue' : 'cyan'}>
                {detailRun.source === 'workflow' ? 'Workflow' : 'Standalone'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[detailRun.status]}>{detailRun.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Files">
              {detailRun.processed_files}/{detailRun.total_files}
              {detailRun.failed_files > 0 && (
                <Tag color="error" style={{ marginLeft: 8 }}>
                  {detailRun.failed_files} failed
                </Tag>
              )}
            </Descriptions.Item>
            {detailRun.workflow_run_id && (
              <Descriptions.Item label="Workflow Run ID">
                {detailRun.workflow_run_id}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Started">
              {detailRun.started_at ? formatLocalDateTime(detailRun.started_at) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Finished">
              {detailRun.finished_at ? formatLocalDateTime(detailRun.finished_at) : '-'}
            </Descriptions.Item>
            {detailRun.error_message && (
              <Descriptions.Item label="Error">
                <span style={{ color: 'red' }}>{detailRun.error_message}</span>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
