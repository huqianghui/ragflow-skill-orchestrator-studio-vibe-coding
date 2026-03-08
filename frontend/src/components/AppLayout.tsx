import { useState } from 'react';
import {
  ApiOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  SendOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Layout, Menu, theme } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';
import { useThemeStore } from '../stores/themeStore';
import { getThemeByKey } from '../themes';

const { Sider, Header, Content } = Layout;

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/skills', icon: <ExperimentOutlined />, label: 'Skill Library' },
  { key: '/connections', icon: <ApiOutlined />, label: 'Connections' },
  { key: '/pipelines', icon: <NodeIndexOutlined />, label: 'Pipelines' },
  { key: '/data-sources', icon: <DatabaseOutlined />, label: 'Data Sources' },
  { key: '/targets', icon: <SendOutlined />, label: 'Targets' },
  { key: '/runs', icon: <HistoryOutlined />, label: 'Run History' },
  { type: 'divider' },
  { key: '/playground', icon: <MessageOutlined />, label: 'Agent Playground' },
  { key: '/playground/history', icon: <HistoryOutlined />, label: 'Agent History' },
  { type: 'divider' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();
  const { themeKey } = useThemeStore();
  const currentTheme = getThemeByKey(themeKey);

  const hasSiderGradient = !!currentTheme.siderBg;
  const hasHeaderGradient = !!currentTheme.headerBg;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={220}
        trigger={null}
        style={{
          background: currentTheme.siderBg || token.colorBgContainer,
          borderRight: hasSiderGradient ? 'none' : undefined,
        }}
      >
        {/* Logo area — with optional gradient accent */}
        <div
          style={{
            padding: collapsed ? '16px 8px' : '16px',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: collapsed ? 14 : 16,
            background: currentTheme.logoBg || undefined,
            color: currentTheme.logoColor || token.colorText,
            borderRadius: currentTheme.logoBg ? '0 0 12px 12px' : undefined,
            margin: currentTheme.logoBg ? '0 8px 8px' : undefined,
            transition: 'all 0.2s',
          }}
        >
          {collapsed ? 'AR' : 'Agentic RAGFlow'}
        </div>

        {/* Collapse toggle button — prominent, above the menu */}
        <div style={{ padding: '0 12px 8px', display: 'flex', justifyContent: 'center' }}>
          <Button
            type="primary"
            ghost={!hasSiderGradient}
            block
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              height: 36,
              fontSize: 15,
              borderRadius: 6,
              ...(hasSiderGradient
                ? {
                    background: 'rgba(255, 255, 255, 0.35)',
                    borderColor: 'rgba(255, 255, 255, 0.6)',
                    color: token.colorPrimary,
                    backdropFilter: 'blur(4px)',
                  }
                : {}),
            }}
          >
            {collapsed ? '' : 'Collapse'}
          </Button>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => { if (key) navigate(key); }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: currentTheme.headerBg || token.colorBgContainer,
            padding: '0 24px',
            borderBottom: hasHeaderGradient
              ? 'none'
              : `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: hasHeaderGradient ? token.colorPrimary : undefined,
            }}
          >
            Agentic RAGFlow Studio
          </span>
          <ThemeSwitcher />
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
