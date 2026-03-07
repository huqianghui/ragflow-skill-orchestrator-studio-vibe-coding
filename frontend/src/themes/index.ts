import { theme, type ThemeConfig } from 'antd';

export interface AppTheme {
  key: string;
  label: string;
  themeConfig: ThemeConfig;
  /** Optional CSS gradient/color for sidebar background (overrides Layout token) */
  siderBg?: string;
  /** Optional CSS gradient/color for header background (overrides Layout token) */
  headerBg?: string;
  /** Optional CSS gradient/color for the logo area */
  logoBg?: string;
  /** Text color for logo area when using gradient backgrounds */
  logoColor?: string;
}

export const themes: AppTheme[] = [
  {
    key: 'light',
    label: 'Light',
    themeConfig: {
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
      },
    },
  },
  {
    key: 'dark',
    label: 'Dark',
    themeConfig: {
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
      },
    },
  },
  {
    key: 'sky-blue',
    label: 'Sky Blue',
    siderBg: 'linear-gradient(180deg, #38BDF8 0%, #7DD3FC 40%, #BAE6FD 100%)',
    headerBg: 'linear-gradient(90deg, #7DD3FC 0%, #BAE6FD 30%, #E0F2FE 100%)',
    logoBg: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)',
    logoColor: '#ffffff',
    themeConfig: {
      token: {
        colorPrimary: '#0284C7',
        colorInfo: '#0EA5E9',
        colorBgLayout: '#E0F2FE',
        colorBgContainer: '#F0F9FF',
        colorBgElevated: '#FFFFFF',
        colorBorderSecondary: '#7DD3FC',
        colorBorder: '#38BDF8',
        borderRadius: 8,
      },
      components: {
        Layout: {
          siderBg: 'transparent',
          headerBg: 'transparent',
          bodyBg: '#E0F2FE',
        },
        Menu: {
          itemBg: 'transparent',
          itemSelectedBg: 'rgba(14, 165, 233, 0.2)',
          itemSelectedColor: '#0369A1',
          itemHoverBg: 'rgba(14, 165, 233, 0.1)',
          itemColor: '#0C4A6E',
          itemHoverColor: '#0369A1',
        },
        Card: {
          colorBgContainer: '#F0F9FF',
          colorBorderSecondary: '#BAE6FD',
        },
        Table: {
          headerBg: '#BAE6FD',
          headerColor: '#0C4A6E',
          rowHoverBg: '#E0F2FE',
        },
        Button: {
          defaultBg: '#E0F2FE',
          defaultBorderColor: '#7DD3FC',
        },
        Input: {
          colorBgContainer: '#F0F9FF',
          activeBorderColor: '#0EA5E9',
        },
        Select: {
          colorBgContainer: '#F0F9FF',
        },
        Modal: {
          contentBg: '#F0F9FF',
          headerBg: '#F0F9FF',
        },
        Tag: {
          defaultBg: '#BAE6FD',
        },
      },
    },
  },
  {
    key: 'deep-violet',
    label: 'Deep Violet',
    siderBg: 'linear-gradient(180deg, #8B5CF6 0%, #A78BFA 40%, #C4B5FD 100%)',
    headerBg: 'linear-gradient(90deg, #A78BFA 0%, #C4B5FD 30%, #EDE9FE 100%)',
    logoBg: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
    logoColor: '#ffffff',
    themeConfig: {
      token: {
        colorPrimary: '#6D28D9',
        colorInfo: '#7C3AED',
        colorBgLayout: '#EDE9FE',
        colorBgContainer: '#F5F3FF',
        colorBgElevated: '#FFFFFF',
        colorBorderSecondary: '#C4B5FD',
        colorBorder: '#A78BFA',
        borderRadius: 8,
      },
      components: {
        Layout: {
          siderBg: 'transparent',
          headerBg: 'transparent',
          bodyBg: '#EDE9FE',
        },
        Menu: {
          itemBg: 'transparent',
          itemSelectedBg: 'rgba(124, 58, 237, 0.2)',
          itemSelectedColor: '#5B21B6',
          itemHoverBg: 'rgba(124, 58, 237, 0.1)',
          itemColor: '#3B0764',
          itemHoverColor: '#5B21B6',
        },
        Card: {
          colorBgContainer: '#F5F3FF',
          colorBorderSecondary: '#C4B5FD',
        },
        Table: {
          headerBg: '#C4B5FD',
          headerColor: '#3B0764',
          rowHoverBg: '#EDE9FE',
        },
        Button: {
          defaultBg: '#EDE9FE',
          defaultBorderColor: '#A78BFA',
        },
        Input: {
          colorBgContainer: '#F5F3FF',
          activeBorderColor: '#7C3AED',
        },
        Select: {
          colorBgContainer: '#F5F3FF',
        },
        Modal: {
          contentBg: '#F5F3FF',
          headerBg: '#F5F3FF',
        },
        Tag: {
          defaultBg: '#C4B5FD',
        },
      },
    },
  },
];

export function getThemeByKey(key: string): AppTheme {
  return themes.find((t) => t.key === key) || themes[0];
}
