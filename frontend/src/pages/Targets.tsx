import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, message, Popconfirm, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Target, TargetType } from '../types';
import { targetsApi } from '../services/api';

const { Title } = Typography;

const TYPE_ICONS: Record<TargetType, string> = {
  azure_ai_search: '/icons/targets/azure-ai-search.svg',
  azure_blob: '/icons/targets/azure-blob-storage.svg',
  cosmosdb_gremlin: '/icons/targets/cosmosdb-gremlin.svg',
  neo4j: '/icons/targets/neo4j.svg',
  mysql: '/icons/targets/mysql.svg',
  postgresql: '/icons/targets/postgresql.svg',
};

const TYPE_COLORS: Record<string, string> = {
  azure_ai_search: 'blue',
  azure_blob: 'cyan',
  cosmosdb_gremlin: 'purple',
  neo4j: 'green',
  mysql: 'orange',
  postgresql: 'geekblue',
};

const TYPE_LABELS: Record<string, string> = {
  azure_ai_search: 'Azure AI Search',
  azure_blob: 'Azure Blob',
  cosmosdb_gremlin: 'CosmosDB Gremlin',
  neo4j: 'Neo4j',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
};

export default function Targets() {
  const navigate = useNavigate();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const res = await targetsApi.list(1, 100);
      setTargets(res.items);
    } catch {
      message.error('Failed to load targets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await targetsApi.test(id);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } catch {
      message.error('Test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await targetsApi.delete(id);
      message.success('Target deleted');
      fetchTargets();
    } catch {
      message.error('Failed to delete target');
    }
  };

  const columns: ColumnsType<Target> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'target_type',
      key: 'target_type',
      render: (type: TargetType) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={TYPE_ICONS[type]}
            alt={type}
            style={{ width: 20, height: 20 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <Tag color={TYPE_COLORS[type]}>{TYPE_LABELS[type] || type}</Tag>
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = { active: 'green', inactive: 'default', error: 'red' };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            loading={testingId === record.id}
            onClick={() => handleTest(record.id)}
          >
            Test
          </Button>
          <Popconfirm
            title="Delete this target?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Output Targets</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/targets/new')}>
          New Target
        </Button>
      </div>
      <Card>
        <Table<Target>
          columns={columns}
          dataSource={targets}
          rowKey="id"
          loading={loading}
        />
      </Card>
    </div>
  );
}
