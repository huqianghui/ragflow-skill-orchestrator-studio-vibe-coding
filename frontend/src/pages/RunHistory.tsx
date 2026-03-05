import { Card, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Run } from '../types';

const { Title } = Typography;

const columns: ColumnsType<Run> = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
  { title: 'Pipeline', dataIndex: 'pipeline_id', key: 'pipeline_id', ellipsis: true },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => {
      const colorMap: Record<string, string> = {
        pending: 'default',
        running: 'processing',
        completed: 'success',
        failed: 'error',
        cancelled: 'warning',
      };
      return <Tag color={colorMap[status]}>{status}</Tag>;
    },
  },
  { title: 'Mode', dataIndex: 'mode', key: 'mode' },
  { title: 'Documents', dataIndex: 'total_documents', key: 'total_documents' },
  { title: 'Started', dataIndex: 'started_at', key: 'started_at' },
  { title: 'Actions', key: 'actions', render: () => <a>View Details</a> },
];

export default function RunHistory() {
  return (
    <div>
      <Title level={3}>Run History</Title>
      <Card>
        <Table<Run> columns={columns} dataSource={[]} rowKey="id" />
      </Card>
    </div>
  );
}
