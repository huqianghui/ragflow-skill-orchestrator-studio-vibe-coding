import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin, Tag, Typography, theme } from 'antd';
import {
  ApiOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  NodeIndexOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Responsive, useContainerWidth } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  connectionsApi,
  dataSourcesApi,
  pipelinesApi,
  runsApi,
  skillsApi,
  targetsApi,
} from '../services/api';

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

const CARDS: CardDef[] = [
  {
    key: 'skills',
    title: 'Skill Library',
    path: '/skills',
    icon: <ExperimentOutlined />,
    color: '#1677ff',
    bg: '#e6f4ff',
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
    key: 'pipelines',
    title: 'Pipelines',
    path: '/pipelines',
    icon: <NodeIndexOutlined />,
    color: '#722ed1',
    bg: '#f9f0ff',
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
    key: 'runhistory',
    title: 'Run History',
    path: '/runs',
    icon: <HistoryOutlined />,
    color: '#faad14',
    bg: '#fffbe6',
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

interface Stats {
  skills: number | null;
  builtinSkills: number | null;
  customSkills: number | null;
  connections: number | null;
  pipelines: number | null;
  datasources: number | null;
  targets: number | null;
  runhistory: number | null;
}

function loadLayouts(): Layouts | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Layouts;
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
  const [stats, setStats] = useState<Stats>({
    skills: null, builtinSkills: null, customSkills: null,
    connections: null, pipelines: null,
    datasources: null, targets: null, runhistory: null,
  });
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<Layouts>(
    () => loadLayouts() || makeDefaultLayouts(),
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [
          skillsResp, pipelinesResp, connectionsResp,
          dsResp, targetsResp, runsResp,
        ] = await Promise.all([
          skillsApi.list(1, 50),
          pipelinesApi.list(1, 10),
          connectionsApi.list(1, 20),
          dataSourcesApi.list(1, 1),
          targetsApi.list(1, 1),
          runsApi.list(1, 1),
        ]);
        const allSkills = skillsResp.items;
        setStats({
          skills: skillsResp.total,
          builtinSkills: allSkills.filter(s => s.is_builtin).length,
          customSkills: allSkills.filter(s => !s.is_builtin).length,
          connections: connectionsResp.total,
          pipelines: pipelinesResp.total,
          datasources: dsResp.total,
          targets: targetsResp.total,
          runhistory: runsResp.total,
        });
      } catch { /* cards show '-' */ } finally {
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

  const getValue = (key: string): number | null => {
    return stats[key as keyof Stats] ?? null;
  };

  const getSubtitle = (key: string): React.ReactNode => {
    if (key === 'skills') {
      return (
        <span style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <Tag color="blue" style={{ margin: 0 }}>{stats.builtinSkills ?? 0} built-in</Tag>
          <Tag color="green" style={{ margin: 0 }}>{stats.customSkills ?? 0} custom</Tag>
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
                onClick={() => navigate(card.path)}
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
                      {getValue(card.key) ?? '-'}
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
