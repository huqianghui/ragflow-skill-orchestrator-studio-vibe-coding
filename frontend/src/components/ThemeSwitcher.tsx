import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { themes } from '../themes';
import { useThemeStore } from '../stores/themeStore';

export default function ThemeSwitcher() {
  const { themeKey, setTheme } = useThemeStore();

  const items: MenuProps['items'] = themes.map((t) => ({
    key: t.key,
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {t.label}
        {themeKey === t.key && <CheckOutlined style={{ color: '#1677ff' }} />}
      </span>
    ),
  }));

  return (
    <Dropdown
      menu={{
        items,
        selectedKeys: [themeKey],
        onClick: ({ key }) => setTheme(key),
      }}
      trigger={['click']}
    >
      <Button type="text" icon={<BgColorsOutlined style={{ fontSize: 18 }} />} />
    </Dropdown>
  );
}
