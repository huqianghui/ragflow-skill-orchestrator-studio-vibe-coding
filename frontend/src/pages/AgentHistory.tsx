import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Modal, Popconfirm, Select, Spin, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CopyOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { AgentSession } from '../types/agent';
import { agentApi } from '../services/agentApi';
import { formatRelativeTime, formatLocalDateTime } from '../utils/time';
import { ResizableTitle, makeResizeHandler } from '../components/TableUtils';
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

interface PreviewMessage {
  id: string;
  role: string;
  content: string;
  created_at: string | null;
}

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
  const [colWidths, setColWidths] = useState({ sessionId: 280, agent: 140 });
  const handleResize = makeResizeHandler(setColWidths);

  // Distinct agent names for the agent filter dropdown
  const [agentOptions, setAgentOptions] = useState<{ label: string; value: string }[]>([]);

  // Session Detail Modal state
  const [previewSession, setPreviewSession] = useState<AgentSession | null>(null);
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const handleCopySessionId = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sessionId);
    message.success('Copied!');
  };

  const handlePreview = async (session: AgentSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewSession(session);
    setPreviewLoading(true);
    setPreviewMessages([]);
    try {
      const msgs = await agentApi.getSessionMessages(session.id);
      setPreviewMessages(msgs);
    } catch {
      message.error('Failed to load messages');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleContinueInPlayground = () => {
    if (!previewSession) return;
    setPreviewSession(null);
    navigate(
      `/playground?agent=${encodeURIComponent(previewSession.agent_name)}&session=${previewSession.id}`,
    );
  };

  // Client-side filtering
  const filteredData = useMemo(() => {
    let result = data;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (s) =>
          (s.native_session_id || '').toLowerCase().includes(lower) ||
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
      title: 'Session ID',
      dataIndex: 'native_session_id',
      key: 'native_session_id',
      width: colWidths.sessionId,
      sorter: (a, b) =>
        (a.native_session_id || '').localeCompare(b.native_session_id || ''),
      onHeaderCell: () => ({
        width: colWidths.sessionId,
        onResize: handleResize('sessionId', 150),
      }),
      render: (_: unknown, record: AgentSession) => {
        if (!record.native_session_id) {
          return <span style={{ color: '#999', fontStyle: 'italic' }}>(pending)</span>;
        }
        const truncated = record.native_session_id.length > 20
          ? record.native_session_id.slice(0, 20) + '...'
          : record.native_session_id;
        return (
          <Tooltip title={record.native_session_id}>
            <span
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleCopySessionId(record.native_session_id!, e)}
            >
              {truncated}
              <CopyOutlined style={{ marginLeft: 4, color: '#999', fontSize: 12 }} />
            </span>
          </Tooltip>
        );
      },
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
      width: 80,
      render: (_: unknown, record: AgentSession) => (
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <EyeOutlined
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={(e) => handlePreview(record, e)}
          />
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
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Agent Session History" />
      <Card>
        <ListToolbar
          searchPlaceholder="Search by session ID or agent"
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
          scroll={{
            x: colWidths.sessionId + colWidths.agent + 90 + 130 + 165 + 120 + 80,
          }}
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

      {/* Session Detail Modal */}
      <Modal
        title="Session Detail"
        open={!!previewSession}
        onCancel={() => setPreviewSession(null)}
        footer={
          <button
            type="button"
            onClick={handleContinueInPlayground}
            style={{
              padding: '6px 16px',
              background: '#1677ff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Continue in Playground
          </button>
        }
        width={720}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
      >
        {previewSession && (
          <>
            {/* Session metadata */}
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Session ID: </strong>
                <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                  {previewSession.native_session_id || '(pending)'}
                </span>
                {previewSession.native_session_id && (
                  <CopyOutlined
                    style={{ marginLeft: 6, color: '#1677ff', cursor: 'pointer', fontSize: 12 }}
                    onClick={() => {
                      navigator.clipboard.writeText(previewSession.native_session_id!);
                      message.success('Copied!');
                    }}
                  />
                )}
              </div>
              <span style={{ marginRight: 16 }}>
                <strong>Agent: </strong>{previewSession.agent_name}
              </span>
              <Tag color={MODE_COLOR[previewSession.mode] || 'default'}>
                {previewSession.mode}
              </Tag>
              <Tag>{previewSession.source}</Tag>
            </div>

            {/* Chat messages */}
            {previewLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="Loading messages..." />
              </div>
            ) : previewMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                No messages in this session
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {previewMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: msg.role === 'user' ? '#e6f4ff' : '#f6f6f6',
                    }}
                  >
                    <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tag color={msg.role === 'user' ? 'blue' : 'green'}>
                        {msg.role === 'user' ? 'User' : 'Assistant'}
                      </Tag>
                      {msg.created_at && (
                        <span style={{ fontSize: 12, color: '#999' }}>
                          {formatLocalDateTime(msg.created_at)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word' }}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
