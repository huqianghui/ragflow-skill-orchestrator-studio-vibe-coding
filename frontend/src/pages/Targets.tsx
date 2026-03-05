import { Button, Card, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Target } from '../types';

const { Title } = Typography;

const columns: ColumnsType<Target> = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  {
    title: 'Type',
    dataIndex: 'target_type',
    key: 'target_type',
    render: (type: string) => <Tag color="blue">{type}</Tag>,
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
  { title: 'Actions', key: 'actions', render: () => <a>Configure</a> },
];

export default function Targets() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Output Targets</Title>
        <Button type="primary" icon={<PlusOutlined />}>New Target</Button>
      </div>
      <Card>
        <Table<Target> columns={columns} dataSource={[]} rowKey="id" />
      </Card>
    </div>
  );
}
