import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Select, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Run } from '../types';
import { runsApi } from '../services/api';
import { ResizableTitle, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning',
};

export default function RunHistory() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const [colWidths, setColWidths] = useState({ id: 220, pipeline: 220 });
  const handleResize = makeResizeHandler(setColWidths);

  const fetchRuns = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const data = await runsApi.list(p, ps);
      setRuns(data.items);
      setTotal(data.total);
    } catch {
      message.error('Failed to load run history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns(page, pageSize);
  }, [page, pageSize, fetchRuns]);

  const filteredRuns = useMemo(() => {
    let result = runs;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(lower) ||
          r.pipeline_id.toLowerCase().includes(lower),
      );
    }
    if (statusFilter.length > 0) {
      result = result.filter((r) => statusFilter.includes(r.status));
    }
    return result;
  }, [runs, searchText, statusFilter]);

  const columns: ColumnsType<Run> = [
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
    },
    {
      title: 'Pipeline',
      dataIndex: 'pipeline_id',
      key: 'pipeline_id',
      width: colWidths.pipeline,
      ellipsis: true,
      onHeaderCell: () => ({
        width: colWidths.pipeline,
        onResize: handleResize('pipeline', 120),
      }),
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
    { title: 'Mode', dataIndex: 'mode', key: 'mode', width: 100 },
    {
      title: 'Documents',
      dataIndex: 'total_documents',
      key: 'total_documents',
      width: 100,
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
  ];

  return (
    <div>
      <PageHeader title="Run History" />
      <Card>
        <ListToolbar
          searchPlaceholder="Search by ID or pipeline"
          onSearch={setSearchText}
          filters={
            <Select
              mode="multiple"
              placeholder="Filter by status"
              allowClear
              options={STATUS_OPTIONS}
              onChange={setStatusFilter}
              style={{ minWidth: 200 }}
            />
          }
        />
        <Table<Run>
          columns={columns}
          dataSource={filteredRuns}
          rowKey="id"
          loading={loading}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: colWidths.id + colWidths.pipeline + 110 + 100 + 100 + 160 }}
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
    </div>
  );
}
