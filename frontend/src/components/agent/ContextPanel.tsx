import { Space, Tag, Typography } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import type { Attachment } from '../../types/agent';

const { Text } = Typography;

interface ContextPanelProps {
  autoContext?: {
    type: 'skill' | 'pipeline';
    data: Record<string, unknown>;
    selectedNode?: string;
    errorResult?: Record<string, unknown>;
  };
  attachments: Attachment[];
  onAddAttachment: (type: 'skill' | 'pipeline' | 'text') => void;
  onRemoveAttachment: (index: number) => void;
  compact?: boolean;
}

export default function ContextPanel({
  autoContext, attachments, onRemoveAttachment, compact,
}: ContextPanelProps) {
  const hasContext = !!autoContext || attachments.length > 0;

  if (!hasContext && compact) return null;

  return (
    <div style={{ marginBottom: compact ? 6 : 10, padding: compact ? '4px 0' : '6px 0' }}>
      <Space size={4} wrap>
        {autoContext && (
          <Tag
            color="blue"
            style={{
              fontSize: compact ? 11 : 12,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={`${autoContext.type === 'skill' ? 'Skill' : 'Pipeline'}: ${String(autoContext.data?.name || 'current')}`}
          >
            <PaperClipOutlined /> {autoContext.type === 'skill' ? 'Skill' : 'Pipeline'}: {String(autoContext.data?.name || 'current')}
          </Tag>
        )}
        {autoContext?.errorResult && (
          <Tag color="red" style={{ fontSize: compact ? 11 : 12 }}>Error context</Tag>
        )}
        {attachments.map((att, idx) => (
          <Tag
            key={idx}
            closable
            onClose={() => onRemoveAttachment(idx)}
            style={{ fontSize: compact ? 11 : 12 }}
          >
            {att.label}
          </Tag>
        ))}
      </Space>
      {!compact && !hasContext && (
        <Text type="secondary" style={{ fontSize: 12 }}>No context attached</Text>
      )}
    </div>
  );
}
