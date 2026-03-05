import { Card, Descriptions, Typography } from 'antd';

const { Title } = Typography;

export default function Settings() {
  return (
    <div>
      <Title level={3}>System Settings</Title>
      <Card title="Configuration">
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Version">0.1.0</Descriptions.Item>
          <Descriptions.Item label="Database">SQLite (local)</Descriptions.Item>
          <Descriptions.Item label="Max Upload Size">100 MB</Descriptions.Item>
          <Descriptions.Item label="Sync Timeout">300s</Descriptions.Item>
          <Descriptions.Item label="Cleanup Retention">7 days</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
