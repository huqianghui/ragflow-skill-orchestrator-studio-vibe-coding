import {
  RobotOutlined, CodeOutlined, GithubOutlined, GoogleOutlined,
  CloudOutlined, ThunderboltOutlined, ApiOutlined, BulbOutlined,
} from '@ant-design/icons';
import type { CSSProperties } from 'react';

const ICON_MAP: Record<string, {
  icon: typeof RobotOutlined;
  color: string;
  bg: string;
}> = {
  'claude-code': { icon: RobotOutlined, color: '#d97706', bg: '#fef3c7' },
  codex: { icon: CodeOutlined, color: '#10a37f', bg: '#d1fae5' },
  copilot: { icon: GithubOutlined, color: '#6e40c9', bg: '#ede9fe' },
  'amazon-q': { icon: CloudOutlined, color: '#ff9900', bg: '#fff7e6' },
  gemini: { icon: GoogleOutlined, color: '#4285f4', bg: '#e8f0fe' },
  cursor: { icon: ThunderboltOutlined, color: '#000000', bg: '#f0f0f0' },
  windsurf: { icon: ThunderboltOutlined, color: '#00b4d8', bg: '#e0f7fa' },
  cline: { icon: CodeOutlined, color: '#e91e63', bg: '#fce4ec' },
  continue: { icon: BulbOutlined, color: '#ff6f00', bg: '#fff3e0' },
  roocode: { icon: CodeOutlined, color: '#2e7d32', bg: '#e8f5e9' },
  kilocode: { icon: CodeOutlined, color: '#1565c0', bg: '#e3f2fd' },
  kiro: { icon: CloudOutlined, color: '#ff5722', bg: '#fbe9e7' },
  trae: { icon: RobotOutlined, color: '#3f51b5', bg: '#e8eaf6' },
  auggie: { icon: BulbOutlined, color: '#7b1fa2', bg: '#f3e5f5' },
  qwen: { icon: ApiOutlined, color: '#6200ea', bg: '#ede7f6' },
};

const DEFAULT_ENTRY = {
  icon: RobotOutlined,
  color: '#6b7280',
  bg: '#f3f4f6',
};

interface AgentIconProps {
  name: string;
  size?: number;
  style?: CSSProperties;
}

/** Renders a colored icon badge for each agent. */
export default function AgentIcon({ name, size = 24, style }: AgentIconProps) {
  const entry = ICON_MAP[name] || DEFAULT_ENTRY;
  const IconComp = entry.icon;
  const boxSize = size + 8;

  return (
    <div style={{
      width: boxSize,
      height: boxSize,
      borderRadius: 6,
      background: entry.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>
      <IconComp style={{ fontSize: size * 0.7, color: entry.color }} />
    </div>
  );
}
