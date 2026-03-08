## MODIFIED Requirements

### Requirement: Theme definitions

系统 SHALL 内置 4 套主题配置：
1. **Light** — Ant Design 默认浅色主题
2. **Dark** — 基于 `theme.darkAlgorithm` 的暗色主题
3. **Sky Blue** — 蓝色品牌风格（**默认激活**）
4. **Deep Violet** — 紫色品牌风格

每套主题 MUST 定义为 Ant Design `ThemeConfig` 对象，包含 `algorithm`、`token`（colorPrimary、colorBgLayout 等）。

#### Scenario: Default theme on first visit

- **WHEN** 用户首次访问应用（localStorage 无 `app-theme` 记录）
- **THEN** 系统使用 Sky Blue 主题渲染所有页面

#### Scenario: Existing users retain their choice

- **WHEN** 用户 localStorage 中已有 `app-theme` 记录（如 `light`）
- **THEN** 系统继续使用用户之前选择的主题
- **AND** 不强制切换到 Sky Blue

#### Scenario: Theme configuration structure

- **WHEN** 开发者查看主题定义文件
- **THEN** 每套主题包含 `key`（唯一标识）、`label`（显示名称）、`themeConfig`（Ant Design ThemeConfig 对象）
