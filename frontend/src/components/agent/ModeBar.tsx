import { Space, Typography } from 'antd';

const { Text } = Typography;

interface ModeBarProps {
  modes: string[];
  selectedMode: string;
  onModeChange: (mode: string) => void;
}

/** Horizontal mode selector bar with highlighted current mode label. */
export default function ModeBar({ modes, selectedMode, onModeChange }: ModeBarProps) {
  if (modes.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 0',
      borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
      marginBottom: 8,
    }}>
      <Text type="secondary" style={{ fontSize: 11, letterSpacing: 1, flexShrink: 0 }}>
        MODE
      </Text>
      <Space size={4}>
        {modes.map(m => {
          const isActive = m === selectedMode;
          return (
            <div
              key={m}
              onClick={() => onModeChange(m)}
              style={{
                padding: '4px 14px',
                borderRadius: 16,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: isActive
                  ? 'var(--ant-color-primary, #1677ff)'
                  : 'var(--ant-color-fill-tertiary, #f5f5f5)',
                color: isActive
                  ? '#fff'
                  : 'var(--ant-color-text-secondary, #666)',
                userSelect: 'none',
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </div>
          );
        })}
      </Space>
    </div>
  );
}
