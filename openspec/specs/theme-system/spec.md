## ADDED Requirements

### Requirement: Theme definitions
系统 SHALL 内置 4 套主题配置：
1. **Light** — Ant Design 默认浅色主题（默认激活）
2. **Dark** — 基于 `theme.darkAlgorithm` 的暗色主题
3. **Blue Professional** — 浅色底 + 深蓝品牌色 (`colorPrimary: '#003eb3'`)
4. **Purple Vibrant** — 浅色底 + 紫色品牌色 (`colorPrimary: '#722ed1'`)

每套主题 MUST 定义为 Ant Design `ThemeConfig` 对象，包含 `algorithm`、`token`（colorPrimary、colorBgLayout 等）。

#### Scenario: Default theme on first visit
- **WHEN** 用户首次访问应用（localStorage 无 `app-theme` 记录）
- **THEN** 系统使用 Light 主题渲染所有页面

#### Scenario: Theme configuration structure
- **WHEN** 开发者查看主题定义文件
- **THEN** 每套主题包含 `key`（唯一标识）、`label`（显示名称）、`themeConfig`（Ant Design ThemeConfig 对象）

### Requirement: Theme switcher component
系统 SHALL 提供一个 `ThemeSwitcher` 组件，让用户在所有页面中随时切换主题。

#### Scenario: Theme switcher in header
- **WHEN** 用户在任意页面查看顶部导航栏
- **THEN** 顶栏右侧显示主题切换入口（图标或下拉按钮）

#### Scenario: Switch theme via dropdown
- **WHEN** 用户点击主题切换入口
- **THEN** 显示下拉菜单列出所有 4 套主题，当前主题有选中标记
- **WHEN** 用户选择一个新主题
- **THEN** 页面立即切换到所选主题，无需刷新页面

### Requirement: Theme persistence
系统 SHALL 将用户的主题选择持久化到 localStorage。

#### Scenario: Theme persists across sessions
- **WHEN** 用户选择 Dark 主题后关闭浏览器
- **THEN** 下次打开应用时自动使用 Dark 主题

#### Scenario: Theme stored in localStorage
- **WHEN** 用户切换主题
- **THEN** 系统将主题 key 保存到 localStorage 的 `app-theme` key 中

### Requirement: Theme state management
系统 SHALL 使用 Zustand store 管理全局主题状态。

#### Scenario: Theme store provides current theme
- **WHEN** 任何组件需要读取当前主题
- **THEN** 可通过 `useThemeStore()` hook 获取当前主题 key 和 ThemeConfig

#### Scenario: Theme store provides setter
- **WHEN** ThemeSwitcher 组件需要切换主题
- **THEN** 调用 `useThemeStore().setTheme(themeKey)` 即可全局生效

### Requirement: ConfigProvider integration
系统 SHALL 在 App 根组件中使用 Ant Design `ConfigProvider` 应用当前主题。

#### Scenario: All antd components reflect theme
- **WHEN** 主题切换为 Dark
- **THEN** 所有 Ant Design 组件（Button、Table、Card、Modal 等）自动使用暗色样式

#### Scenario: Layout background adapts to theme
- **WHEN** 主题切换为 Dark
- **THEN** 页面整体背景色、侧边栏、顶栏均适配暗色
