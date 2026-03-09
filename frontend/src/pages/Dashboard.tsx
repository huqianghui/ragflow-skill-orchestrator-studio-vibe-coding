import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin, Tag, Typography, theme } from 'antd';
import {
  ApiOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Responsive, useContainerWidth } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { dashboardApi } from '../services/api';
import type { DashboardStats } from '../types';

const { Title, Text } = Typography;

const STORAGE_KEY = 'dashboard-layouts';

interface CardDef {
  key: string;
  title: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

/* Card order matches sidebar menu grouping:
   Orchestration → Resources → Runs → Agents */
const CARDS: CardDef[] = [
  {
    key: 'workflows',
    title: 'Workflows',
    path: '/workflows',
    icon: <BranchesOutlined />,
    color: '#2f54eb',
    bg: '#f0f5ff',
  },
  {
    key: 'pipelines',
    title: 'Pipelines',
    path: '/pipelines',
    icon: <NodeIndexOutlined />,
    color: '#722ed1',
    bg: '#f9f0ff',
  },
  {
    key: 'skills',
    title: 'Skills',
    path: '/skills',
    icon: <ExperimentOutlined />,
    color: '#1677ff',
    bg: '#e6f4ff',
  },
  {
    key: 'datasources',
    title: 'Data Sources',
    path: '/data-sources',
    icon: <DatabaseOutlined />,
    color: '#fa8c16',
    bg: '#fff7e6',
  },
  {
    key: 'targets',
    title: 'Targets',
    path: '/targets',
    icon: <SendOutlined />,
    color: '#13c2c2',
    bg: '#e6fffb',
  },
  {
    key: 'connections',
    title: 'Connections',
    path: '/connections',
    icon: <ApiOutlined />,
    color: '#52c41a',
    bg: '#f6ffed',
  },
  {
    key: 'workflow_runs',
    title: 'Workflow Runs',
    path: '/workflow-runs',
    icon: <PlayCircleOutlined />,
    color: '#eb2f96',
    bg: '#fff0f6',
  },
  {
    key: 'pipeline_runs',
    title: 'Pipeline Runs',
    path: '/pipeline-runs',
    icon: <HistoryOutlined />,
    color: '#faad14',
    bg: '#fffbe6',
  },
  {
    key: 'agents',
    title: 'Agents',
    path: '/playground',
    icon: <RobotOutlined />,
    color: '#eb2f96',
    bg: '#fff0f6',
  },
];

function makeDefaultLayouts(): Layouts {
  return {
    lg: CARDS.map((c, i) => ({
      i: c.key, x: (i % 3) * 4, y: Math.floor(i / 3) * 2,
      w: 4, h: 2, minW: 3, minH: 2,
    })),
    md: CARDS.map((c, i) => ({
      i: c.key, x: (i % 2) * 6, y: Math.floor(i / 2) * 2,
      w: 6, h: 2, minW: 4, minH: 2,
    })),
    sm: CARDS.map((c, i) => ({
      i: c.key, x: 0, y: i * 2,
      w: 12, h: 2, minW: 12, minH: 2,
    })),
  };
}

function loadLayouts(): Layouts | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as Layouts;
    const defaults = makeDefaultLayouts();
    const allKeys = new Set(CARDS.map(c => c.key));
    for (const bp of Object.keys(defaults) as Array<keyof Layouts>) {
      if (!saved[bp]) {
        saved[bp] = defaults[bp];
        continue;
      }
      const items = saved[bp] as Layout[];
      const existing = new Set(items.map(l => l.i));
      let maxBottom = 0;
      for (const l of items) {
        maxBottom = Math.max(maxBottom, l.y + l.h);
      }
      for (const dl of defaults[bp] as Layout[]) {
        if (allKeys.has(dl.i) && !existing.has(dl.i)) {
          items.push({ ...dl, y: maxBottom });
          maxBottom += dl.h;
        }
      }
    }
    return saved;
  } catch { /* ignore */ }
  return undefined;
}

function saveLayouts(layouts: Layouts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch { /* ignore */ }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<Layouts>(
    () => loadLayouts() || makeDefaultLayouts(),
  );
  const isDragging = useRef(false);

  const handleDragHandleMouseDown = useCallback(() => {
    isDragging.current = true;
    const onUp = () => {
      setTimeout(() => { isDragging.current = false; }, 100);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await dashboardApi.getStats();
        setStats(data);
      } catch { /* stats stays null, cards show '-' */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onLayoutChange = useCallback(
    (_current: Layout[], allLayouts: Layouts) => {
      setLayouts(allLayouts);
      saveLayouts(allLayouts);
    },
    [],
  );

  const { token } = theme.useToken();

  if (loading) {
    return <Spin style={{ display: 'block', margin: '120px auto' }} size="large" />;
  }

  const getValue = (key: string): number | string => {
    if (!stats) return '-';
    const countMap: Record<string, number> = {
      skills: stats.counts.skills,
      connections: stats.counts.connections,
      pipelines: stats.counts.pipelines,
      datasources: stats.counts.data_sources,
      targets: stats.counts.targets,
      workflows: stats.counts.workflows,
      workflow_runs: stats.counts.workflow_runs,
      pipeline_runs: stats.counts.runs,
      agents: stats.counts.agents,
    };
    return countMap[key] ?? '-';
  };

  const getSubtitle = (key: string): React.ReactNode => {
    if (!stats) return null;
    if (key === 'skills') {
      return (
        <span style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <Tag color="blue" style={{ margin: 0 }}>
            {stats.skill_breakdown.builtin} built-in
          </Tag>
          <Tag color="green" style={{ margin: 0 }}>
            {stats.skill_breakdown.custom} custom
          </Tag>
        </span>
      );
    }
    if (key === 'agents') {
      return (
        <span style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <Tag color="success" style={{ margin: 0 }}>
            {stats.agent_breakdown.available} online
          </Tag>
          <Tag color="default" style={{ margin: 0 }}>
            {stats.agent_breakdown.unavailable} offline
          </Tag>
        </span>
      );
    }
    if (key === 'workflow_runs') {
      return (
        <span style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <Tag color="blue" style={{ margin: 0 }}>
            {stats.workflow_run_stats.success_rate}% success
          </Tag>
        </span>
      );
    }
    return null;
  };

  return (
    <div ref={containerRef}>
      <Title level={3} style={{ marginBottom: 16 }}>Dashboard</Title>

      {mounted && (
        <Responsive
          className="dashboard-grid"
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 996, md: 768, sm: 0 }}
          cols={{ lg: 12, md: 12, sm: 12 }}
          rowHeight={70}
          onLayoutChange={onLayoutChange}
          draggableHandle=".drag-handle"
          isResizable
          isDraggable
          margin={[16, 16]}
        >
          {CARDS.map((card) => (
            <div key={card.key}>
              <Card
                hoverable
                onClick={() => { if (!isDragging.current) navigate(card.path); }}
                style={{
                  height: '100%',
                  cursor: 'pointer',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                styles={{
                  body: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '20px 24px',
                  },
                }}
              >
                {/* Drag handle — top grip bar */}
                <div
                  className="drag-handle"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 14,
                    cursor: 'grab',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseDown={handleDragHandleMouseDown}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                >
                  <div style={{
                    width: 32, height: 4, borderRadius: 2,
                    background: token.colorBorderSecondary,
                  }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: card.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, color: card.color, flexShrink: 0,
                  }}>
                    {card.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>{card.title}</Text>
                    <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2 }}>
                      {getValue(card.key)}
                    </div>
                    {getSubtitle(card.key)}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </Responsive>
      )}

    </div>
  );
}
