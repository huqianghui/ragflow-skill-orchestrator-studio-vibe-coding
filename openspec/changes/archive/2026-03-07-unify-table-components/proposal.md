## Why

项目中 6 个列表页面（Skills、Pipelines、DataSources、Targets、Connections、RunHistory）各自独立实现了 Ant Design Table，功能水平参差不齐。SkillLibrary 页面具备完整的表格特性（可拖拽调整列宽、搜索过滤、排序、文字溢出 Popover、标准化分页），而其他页面缺少大量关键功能，导致用户体验不一致。需要将 SkillLibrary 的表格模式提取为统一规范，并应用到所有列表页。

## What Changes

- 提取可复用的表格基础组件和工具函数（ResizableTitle、OverflowPopover）到 `components/` 共享目录
- 为所有列表页表格统一添加：
  - 可拖拽调整列宽（react-resizable ResizableTitle）
  - 列排序（sorter）
  - 搜索栏（Input.Search，按名称/描述搜索）
  - 固定表格布局（tableLayout="fixed"）
  - 长文本溢出 Popover 提示（OverflowPopover）
  - 标准化分页配置（showSizeChanger、pageSizeOptions、showTotal）
- 受影响的页面：Pipelines、DataSources、Targets、Connections、RunHistory
- SkillLibrary 作为参考不变，仅将其共享部分提取到公共组件

## Capabilities

### New Capabilities

- `unified-table-ui`: 统一表格 UI 规范，包含共享组件（ResizableTitle、OverflowPopover）和各列表页的升级要求

### Modified Capabilities


## Impact

- **前端代码**：修改 5 个页面组件（Pipelines.tsx、DataSources.tsx、Targets.tsx、Connections.tsx、RunHistory.tsx），新增 1-2 个共享组件文件
- **依赖**：`react-resizable` 已在项目中安装（SkillLibrary 使用），无需新增依赖
- **API**：无后端变更
- **数据库**：无变更
