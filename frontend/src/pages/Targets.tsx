import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, message, Popconfirm, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Target, TargetType } from '../types';
import { targetsApi } from '../services/api';
import { ResizableTitle, OverflowPopover, makeResizeHandler } from '../components/TableUtils';
import PageHeader from '../components/PageHeader';
import ListToolbar from '../components/ListToolbar';

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
  const [total, setTotal] = useState(0);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Search
  const [searchText, setSearchText] = useState('');

  // Resizable column widths
  const [colWidths, setColWidths] = useState({ name: 160 });
  const handleResize = makeResizeHandler(setColWidths);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const res = await targetsApi.list(1, 100);
      setTargets(res.items);
      setTotal(res.total);
    } catch {
      message.error('Failed to load targets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  // Client-side search filter
  const filteredTargets = useMemo(() => {
    if (!searchText) return targets;
    const lower = searchText.toLowerCase();
    return targets.filter(
      (t) => t.name.toLowerCase().includes(lower),
    );
  }, [targets, searchText]);

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
      width: colWidths.name,
      sorter: (a, b) => a.name.localeCompare(b.name),
      onHeaderCell: () => ({
        width: colWidths.name,
        onResize: handleResize('name', 100),
      }),
      render: (name: string) => <OverflowPopover text={name} />,
    },
    {
      title: 'Type',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 200,
      sorter: (a, b) => a.target_type.localeCompare(b.target_type),
      render: (type: TargetType) => (
        <Space>
          <img
            src={TYPE_ICONS[type]}
            alt={type}
            style={{ width: 20, height: 20 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <Tag color={TYPE_COLORS[type]}>{TYPE_LABELS[type] || type}</Tag>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (status: string) => {
        const colorMap: Record<string, string> = { active: 'green', inactive: 'default', error: 'red' };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            loading={testingId === record.id}
            onClick={() => handleTest(record.id)}
          >
            Test
          </Button>
          <Popconfirm
            title="Delete this target?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Output Targets"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/targets/new')}>
            New Target
          </Button>
        }
      />
      <Card>
        <ListToolbar
          searchPlaceholder="Search by name"
          onSearch={setSearchText}
        />

        <Table<Target>
          columns={columns}
          dataSource={filteredTargets}
          rowKey="id"
          loading={loading}
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: colWidths.name + 200 + 100 + 160 + 180 }}
          pagination={{
            total: filteredTargets.length !== targets.length ? filteredTargets.length : total,
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `Total ${t} targets`,
          }}
        />
      </Card>
    </div>
  );
}
