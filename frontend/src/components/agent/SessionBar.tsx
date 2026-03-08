import { Button, Popconfirm, Space, Tag, Typography } from 'antd';
import { CloseOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons';
import type { AgentSession } from '../../types/agent';
import { formatRelativeTime } from '../../utils/time';

const { Text } = Typography;

interface SessionBarProps {
  sessions: AgentSession[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenHistory: () => void;
  loading?: boolean;
}

export default function SessionBar({
  sessions, currentSessionId, onNewSession, onSelectSession, onDeleteSession, onOpenHistory,
}: SessionBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 0',
      borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
      marginBottom: 12,
    }}>
      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onNewSession}>
        New
      </Button>

      <div style={{ flex: 1, overflow: 'auto', whiteSpace: 'nowrap', minWidth: 0 }}>
        {sessions.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            Click + New to start
          </Text>
        ) : (
          <Space size={4}>
            {sessions.map(s => (
              <Tag
                key={s.id}
                color={s.id === currentSessionId ? 'blue' : undefined}
                style={{ cursor: 'pointer', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}
                onClick={() => onSelectSession(s.id)}
              >
                <span style={{ marginRight: 4 }}>{s.title.length > 20 ? s.title.slice(0, 20) + '...' : s.title}</span>
                <Text type="secondary" style={{ fontSize: 10 }}>{formatRelativeTime(s.updated_at)}</Text>
                <Popconfirm
                  title="Delete this session?"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <CloseOutlined
                    style={{ marginLeft: 6, fontSize: 10, color: '#999' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </Tag>
            ))}
          </Space>
        )}
      </div>

      <Button size="small" icon={<HistoryOutlined />} onClick={onOpenHistory}>
        History
      </Button>
    </div>
  );
}
