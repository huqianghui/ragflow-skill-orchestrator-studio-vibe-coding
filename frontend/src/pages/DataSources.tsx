import { Button, Card, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataSource } from '../types';

const { Title } = Typography;

const columns: ColumnsType<DataSource> = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  {
    title: 'Type',
    dataIndex: 'source_type',
    key: 'source_type',
    render: (type: string) => <Tag>{type}</Tag>,
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
  { title: 'Files', dataIndex: 'file_count', key: 'file_count' },
  { title: 'Actions', key: 'actions', render: () => <a>Manage</a> },
];

export default function DataSources() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Data Sources</Title>
        <Button type="primary" icon={<PlusOutlined />}>New Data Source</Button>
      </div>
      <Card>
        <Table<DataSource> columns={columns} dataSource={[]} rowKey="id" />
      </Card>
    </div>
  );
}
