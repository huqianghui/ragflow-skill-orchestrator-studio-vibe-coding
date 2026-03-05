import { Button, Card, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Pipeline } from '../types';

const { Title } = Typography;

const columns: ColumnsType<Pipeline> = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => {
      const colorMap: Record<string, string> = {
        draft: 'default',
        validated: 'blue',
        active: 'green',
        archived: 'gray',
      };
      return <Tag color={colorMap[status]}>{status}</Tag>;
    },
  },
  { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: 'Created', dataIndex: 'created_at', key: 'created_at' },
  {
    title: 'Actions',
    key: 'actions',
    render: () => (
      <Space>
        <a>Edit</a>
        <a>Run</a>
        <a>Delete</a>
      </Space>
    ),
  },
];

export default function Pipelines() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Pipelines</Title>
        <Button type="primary" icon={<PlusOutlined />}>New Pipeline</Button>
      </div>
      <Card>
        <Table<Pipeline> columns={columns} dataSource={[]} rowKey="id" />
      </Card>
    </div>
  );
}
