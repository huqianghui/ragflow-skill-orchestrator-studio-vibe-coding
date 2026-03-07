## Context

项目有 6 个列表页使用 Ant Design Table：SkillLibrary、Pipelines、DataSources、Targets、Connections、RunHistory。SkillLibrary 是最完善的实现，具备可调列宽、搜索、排序、文本溢出 Popover、标准分页等功能。其余 5 个页面功能参差不齐。

当前各页面功能差异对比：

| 功能 | Skills | Pipelines | DataSources | Targets | Connections | RunHistory |
|------|--------|-----------|-------------|---------|-------------|------------|
| 可调列宽 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 搜索 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 列排序 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 溢出 Popover | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 固定布局 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 标准分页 | ✅ | ⚠️ 基础 | ✅ | ❌ | ✅ | ❌ |

## Goals / Non-Goals

**Goals:**
- 提取 SkillLibrary 中的 ResizableTitle 和 OverflowPopover 为共享组件
- 为 5 个列表页统一添加：可调列宽、搜索栏、列排序、溢出提示、标准分页
- 所有表格使用 `tableLayout="fixed"` 并合理设定列宽
- 建立表格组件统一规范，后续新页面照此模式开发

**Non-Goals:**
- 不修改 SkillLibrary 的现有逻辑（仅提取共享部分，SkillLibrary 改为导入共享组件）
- 不改变任何 API 调用逻辑或后端行为
- 不新增类型过滤 Select（仅 Skills 有类型过滤需求，其他页面搜索足够）
- 不实现服务端搜索/排序（当前数据量下客户端过滤足够）
- RunHistory 是占位页（空数据），仅添加列宽和分页配置，不做搜索/排序

## Decisions

### D1: 共享组件存放位置

**决定**: 创建 `frontend/src/components/TableUtils.tsx`，导出 ResizableTitle 和 OverflowPopover。

**理由**: 这两个组件轻量且紧密耦合于 Table 使用场景，放在一个文件中比分散到多个文件更便于管理。

### D2: 搜索实现方式 — 客户端过滤

**决定**: 所有页面使用客户端搜索过滤（与 SkillLibrary 一致），在已加载的数据中过滤。

**理由**: 当前各页面数据量较小（几十到几百条），客户端过滤体验更好（即时响应）。服务端搜索作为后续优化。

**替代方案**: 服务端搜索 API — 数据量大时需要，但当前阶段过度设计。

### D3: 列宽规范

**决定**: 统一列宽约定：
- Name 列：160px（可调）
- Description 列：250-350px（可调）
- Type/Status 列：100-120px（固定）
- Created At 列：160px（固定）
- Actions 列：按按钮数量 180-240px（固定）

**理由**: 参照 SkillLibrary 的比例，确保各页面视觉一致。

### D4: SkillLibrary 改造方式

**决定**: SkillLibrary 改为从 TableUtils 导入 ResizableTitle 和 OverflowPopover，删除自身的内联定义。

**理由**: 消除代码重复，确保单一真相源。

## Risks / Trade-offs

- **[风险] react-resizable CSS 重复导入** → 在 TableUtils 中统一导入 `react-resizable/css/styles.css`，各页面无需重复导入
- **[风险] 客户端搜索在大数据集下性能问题** → 当前数据量小可接受；后续可加服务端搜索
- **[风险] 列宽硬编码可能在窄屏下显示异常** → ResizableTitle 允许用户手动调整；fixed layout 保证不塌缩
- **[权衡] 每个页面单独管理 colWidths state** → 保持简单，不引入全局状态管理。每页的列宽需求不同，局部 state 更灵活
