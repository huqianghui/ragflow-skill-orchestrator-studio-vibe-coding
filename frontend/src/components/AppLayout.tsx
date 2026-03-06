import {
  ApiOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  NodeIndexOutlined,
  SendOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/skills', icon: <ExperimentOutlined />, label: 'Skill Library' },
  { key: '/connections', icon: <ApiOutlined />, label: 'Connections' },
  { key: '/pipelines', icon: <NodeIndexOutlined />, label: 'Pipelines' },
  { key: '/data-sources', icon: <DatabaseOutlined />, label: 'Data Sources' },
  { key: '/targets', icon: <SendOutlined />, label: 'Targets' },
  { key: '/runs', icon: <HistoryOutlined />, label: 'Run History' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible theme="light" width={220}>
        <div style={{ padding: '16px', textAlign: 'center', fontWeight: 700, fontSize: 16 }}>
          Skill Orchestrator
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>RAGFlow Skill Orchestrator Studio</span>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
