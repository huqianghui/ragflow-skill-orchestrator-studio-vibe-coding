import { useCallback, useEffect, useState } from 'react';
import { Card, Descriptions, Progress, Space, Spin, Typography } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import type { UploadQuotaInfo } from '../types';
import { dataSourcesApi } from '../services/api';

const { Title, Text } = Typography;

function quotaColor(percent: number): string {
  if (percent > 90) return '#ff4d4f';
  if (percent > 70) return '#faad14';
  return '#52c41a';
}

export default function Settings() {
  const [quota, setQuota] = useState<UploadQuotaInfo | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  const fetchQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      const info = await dataSourcesApi.getQuota();
      setQuota(info);
    } catch {
      // ignore — section will show fallback
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const usedPercent = quota ? Math.round((quota.used_mb / quota.total_mb) * 100) : 0;

  return (
    <div>
      <Title level={3}>System Settings</Title>

      <Card title="Configuration" style={{ marginBottom: 24 }}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Version">0.1.0</Descriptions.Item>
          <Descriptions.Item label="Database">SQLite (local)</Descriptions.Item>
          <Descriptions.Item label="Sync Timeout">300s</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={
          <Space>
            <CloudUploadOutlined />
            <span>Upload Storage</span>
          </Space>
        }
      >
        {quotaLoading ? (
          <Spin />
        ) : quota ? (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Temp Directory">{quota.temp_dir}</Descriptions.Item>
              <Descriptions.Item label="Max File Size">{quota.max_file_size_mb} MB</Descriptions.Item>
              <Descriptions.Item label="Total Quota">{quota.total_mb} MB</Descriptions.Item>
              <Descriptions.Item label="Used">{quota.used_mb.toFixed(1)} MB</Descriptions.Item>
              <Descriptions.Item label="Available">{quota.available_mb.toFixed(1)} MB</Descriptions.Item>
              <Descriptions.Item label="Retention">{quota.retention_days} days</Descriptions.Item>
            </Descriptions>
            <div style={{ maxWidth: 400 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Storage usage: {quota.used_mb.toFixed(1)} MB / {quota.total_mb} MB ({usedPercent}%)
              </Text>
              <Progress
                percent={usedPercent}
                strokeColor={quotaColor(usedPercent)}
                size="small"
              />
            </div>
          </>
        ) : (
          <Text type="secondary">Unable to load upload quota information.</Text>
        )}
      </Card>
    </div>
  );
}
