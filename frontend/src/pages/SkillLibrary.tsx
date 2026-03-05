import { Button, Card, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Skill } from '../types';

const { Title } = Typography;

const columns: ColumnsType<Skill> = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  {
    title: 'Type',
    dataIndex: 'skill_type',
    key: 'skill_type',
    render: (type: string) => {
      const colorMap: Record<string, string> = {
        builtin: 'blue',
        web_api: 'green',
        config_template: 'orange',
        python_code: 'purple',
      };
      return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
    },
  },
  { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  {
    title: 'Built-in',
    dataIndex: 'is_builtin',
    key: 'is_builtin',
    render: (v: boolean) => (v ? <Tag color="blue">Built-in</Tag> : <Tag>Custom</Tag>),
  },
  {
    title: 'Actions',
    key: 'actions',
    render: () => (
      <Space>
        <a>Edit</a>
        <a>Delete</a>
      </Space>
    ),
  },
];

export default function SkillLibrary() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Skill Library</Title>
        <Button type="primary" icon={<PlusOutlined />}>New Skill</Button>
      </div>
      <Card>
        <Table<Skill> columns={columns} dataSource={[]} rowKey="id" />
      </Card>
    </div>
  );
}
