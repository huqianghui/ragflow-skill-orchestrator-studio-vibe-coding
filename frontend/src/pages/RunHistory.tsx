import { Card, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Run } from '../types';
import { ResizableTitle } from '../components/TableUtils';

const { Title } = Typography;

const columns: ColumnsType<Run> = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 280,
    ellipsis: true,
  },
  {
    title: 'Pipeline',
    dataIndex: 'pipeline_id',
    key: 'pipeline_id',
    width: 280,
    ellipsis: true,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 110,
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
  { title: 'Mode', dataIndex: 'mode', key: 'mode', width: 100 },
  { title: 'Documents', dataIndex: 'total_documents', key: 'total_documents', width: 100 },
  { title: 'Started', dataIndex: 'started_at', key: 'started_at', width: 160 },
  { title: 'Actions', key: 'actions', width: 120, render: () => <a>View Details</a> },
];

export default function RunHistory() {
  return (
    <div>
      <Title level={3}>Run History</Title>
      <Card>
        <Table<Run>
          columns={columns}
          dataSource={[]}
          rowKey="id"
          components={{ header: { cell: ResizableTitle } }}
          tableLayout="fixed"
          scroll={{ x: 280 + 280 + 110 + 100 + 100 + 160 + 120 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `Total ${t} runs`,
          }}
        />
      </Card>
    </div>
  );
}
