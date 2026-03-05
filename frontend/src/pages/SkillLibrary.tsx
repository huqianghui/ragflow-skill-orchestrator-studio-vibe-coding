import { useEffect, useState } from 'react';
import { Button, Card, message, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Skill } from '../types';
import { skillsApi } from '../services/api';

const { Title } = Typography;

export default function SkillLibrary() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchSkills = async (p: number, ps: number) => {
    setLoading(true);
    try {
      const data = await skillsApi.list(p, ps);
      setSkills(data.items);
      setTotal(data.total);
    } catch {
      message.error('Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills(page, pageSize);
  }, [page, pageSize]);

  const handleDelete = async (id: string) => {
    try {
      await skillsApi.delete(id);
      message.success('Skill deleted');
      fetchSkills(page, pageSize);
    } catch {
      message.error('Failed to delete skill');
    }
  };

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
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" disabled={record.is_builtin}>
            Edit
          </Button>
          <Button
            type="link"
            size="small"
            danger
            disabled={record.is_builtin}
            onClick={() => handleDelete(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Skill Library</Title>
        <Button type="primary" icon={<PlusOutlined />}>New Skill</Button>
      </div>
      <Card>
        <Table<Skill>
          columns={columns}
          dataSource={skills}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} skills`,
          }}
        />
      </Card>
    </div>
  );
}
