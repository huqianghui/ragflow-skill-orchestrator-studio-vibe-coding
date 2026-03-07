import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';

const { Title } = Typography;

interface PageHeaderProps {
  title: React.ReactNode;
  extra?: React.ReactNode;
  onBack?: () => void;
}

export default function PageHeader({ title, extra, onBack }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}
    >
      <Space>
        {onBack && (
          <Button icon={<ArrowLeftOutlined />} onClick={onBack} />
        )}
        <Title level={3} style={{ margin: 0 }}>
          {title}
        </Title>
      </Space>
      {extra && <div>{extra}</div>}
    </div>
  );
}
