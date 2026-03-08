import { useCallback, useEffect, useState } from 'react';
import { Popconfirm, Table, Typography, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AgentSession } from '../types/agent';
import { agentApi } from '../services/agentApi';
import { formatRelativeTime, formatLocalDateTime } from '../utils/time';

const { Title, Text } = Typography;

export default function AgentHistory() {
  const navigate = useNavigate();
  const [data, setData] = useState<AgentSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await agentApi.listSessions({ page: p, page_size: 20 });
      setData(result.items);
      setTotal(result.total);
      setPage(p);
    } catch {
      message.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  const handleDelete = async (id: string) => {
    try {
      await agentApi.deleteSession(id);
      loadHistory(page);
    } catch {
      message.error('Failed to delete session');
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Agent',
      dataIndex: 'agent_name',
      key: 'agent_name',
      width: 130,
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 80,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 120,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{formatLocalDateTime(val)}</Text>
      ),
    },
    {
      title: 'Last Active',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 110,
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{formatRelativeTime(val)}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: AgentSession) => (
        <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.id)}>
          <DeleteOutlined style={{ color: '#999', cursor: 'pointer' }} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Agent Session History</Title>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          total,
          current: page,
          pageSize: 20,
          onChange: loadHistory,
          showSizeChanger: false,
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/playground?session=${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
}
