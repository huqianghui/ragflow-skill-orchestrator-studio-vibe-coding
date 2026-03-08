import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Popconfirm, Select, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AgentSession } from '../types/agent';
import { agentApi } from '../services/agentApi';
import { formatRelativeTime, formatLocalDateTime } from '../utils/time';
import { ResizableTitle, OverflowPopover, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';

const SOURCE_OPTIONS = [
  { label: 'Playground', value: 'playground' },
  { label: 'Skill Editor', value: 'skill-editor' },
  { label: 'Pipeline Editor', value: 'pipeline-editor' },
];

const MODE_COLOR: Record<string, string> = {
  ask: 'blue',
  code: 'green',
  architect: 'purple',
  edit: 'orange',
};

export default function AgentHistory() {
  const navigate = useNavigate();
  const [data, setData] = useState<AgentSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);

  // Resizable column widths
  const [colWidths, setColWidths] = useState({ title: 250, agent: 140 });
  const handleResize = makeResizeHandler(setColWidths);

  // Distinct agent names for the agent filter dropdown
  const [agentOptions, setAgentOptions] = useState<{ label: string; value: string }[]>([]);

  const loadHistory = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const result = await agentApi.listSessions({ page: p, page_size: ps });
      setData(result.items);
      setTotal(result.total);
      setPage(p);

      // Extract unique agent names for filter options
      const names = Array.from(new Set(result.items.map((s) => s.agent_name)));
      setAgentOptions((prev) => {
        const existing = new Set(prev.map((o) => o.value));
        const merged = [...prev];
        for (const n of names) {
          if (!existing.has(n)) {
            merged.push({ label: n, value: n });
          }
        }
        return merged;
      });
    } catch {
      message.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(1, pageSize);
  }, [loadHistory, pageSize]);

  // Load all agent names on mount for the filter dropdown
  useEffect(() => {
    agentApi.getAvailable().then((agents) => {
      setAgentOptions(agents.map((a) => ({ label: a.display_name, value: a.name })));
    }).catch(() => { /* ignore */ });
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await agentApi.deleteSession(id);
      loadHistory(page, pageSize);
    } catch {
      message.error('Failed to delete session');
    }
  };

  // Client-side filtering
  const filteredData = useMemo(() => {
    let result = data;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(lower) ||
          s.agent_name.toLowerCase().includes(lower),
      );
    }
    if (agentFilter.length > 0) {
      result = result.filter((s) => agentFilter.includes(s.agent_name));
    }
    if (sourceFilter.length > 0) {
      result = result.filter((s) => sourceFilter.includes(s.source));
    }
    return result;
  }, [data, searchText, agentFilter, sourceFilter]);

  const columns: ColumnsType<AgentSession> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: colWidths.title,
      sorter: (a, b) => a.title.localeCompare(b.title),
      onHeaderCell: () => ({
        width: colWidths.title,
        onResize: handleResize('title', 120),
      }),
      render: (text: string) => <OverflowPopover text={text} />,
    },
    {
      title: 'Agent',
      dataIndex: 'agent_name',
      key: 'agent_name',
      width: colWidths.agent,
      sorter: (a, b) => a.agent_name.localeCompare(b.agent_name),
      onHeaderCell: () => ({
        width: colWidths.agent,
        onResize: handleResize('agent', 80),
      }),
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 90,
      sorter: (a, b) => a.mode.localeCompare(b.mode),
      render: (mode: string) => (
        <Tag color={MODE_COLOR[mode] || 'default'}>{mode}</Tag>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 130,
      sorter: (a, b) => a.source.localeCompare(b.source),
      render: (source: string) => (
        <Tag>{source}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 165,
      sorter: (a, b) =>
        new Date(a.created_at + 'Z').getTime() - new Date(b.created_at + 'Z').getTime(),
      render: (val: string) => formatLocalDateTime(val),
    },
    {
      title: 'Last Active',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 120,
      defaultSortOrder: 'descend',
      sorter: (a, b) =>
        new Date(a.updated_at + 'Z').getTime() - new Date(b.updated_at + 'Z').getTime(),
      render: (val: string) => formatRelativeTime(val),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: AgentSession) => (
        <Popconfirm
          title="Delete this session?"
          onConfirm={(e) => handleDelete(record.id, e as unknown as React.MouseEvent)}
          onCancel={(e) => e?.stopPropagation()}
        >
          <DeleteOutlined
            style={{ color: '#999', cursor: 'pointer' }}
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Agent Session History" />
      <Card>
        <ListToolbar
          searchPlaceholder="Search by title or agent"
          onSearch={setSearchText}
          filters={
            <>
              <Select
                mode="multiple"
                placeholder="Filter by agent"
                allowClear
                options={agentOptions}
                onChange={setAgentFilter}
                style={{ minWidth: 180 }}
              />
              <Select
                mode="multiple"
                placeholder="Filter by source"
                allowClear
                options={SOURCE_OPTIONS}
                onChange={setSourceFilter}
                style={{ minWidth: 180 }}
              />
            </>
          }
        />
        <Table<AgentSession>
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          size="small"
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: colWidths.title + colWidths.agent + 90 + 130 + 165 + 120 + 50 }}
          pagination={{
            current: page,
            pageSize,
            total: filteredData.length !== data.length ? filteredData.length : total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `Total ${t} sessions`,
          }}
          onRow={(record) => ({
            onClick: () =>
              navigate(
                `/playground?agent=${encodeURIComponent(record.agent_name)}&session=${record.id}`,
              ),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  );
}
