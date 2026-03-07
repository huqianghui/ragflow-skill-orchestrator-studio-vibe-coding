## 1. 共享组件提取

- [x] 1.1 创建 `frontend/src/components/TableUtils.tsx`，从 SkillLibrary 提取 ResizableTitle 和 OverflowPopover 组件，导入 react-resizable CSS
- [x] 1.2 修改 SkillLibrary.tsx，删除内联的 ResizableTitle 和 OverflowPopover 定义，改为从 TableUtils 导入，验证页面行为不变

## 2. Pipelines 页面升级

- [x] 2.1 Pipelines.tsx 添加搜索栏（Input.Search，按 name/description 过滤）、客户端搜索状态和过滤逻辑
- [x] 2.2 Pipelines.tsx 添加列排序（Name、Status、Nodes、Created At 列 sorter）
- [x] 2.3 Pipelines.tsx 切换到 tableLayout="fixed"，添加 ResizableTitle、列宽 state、OverflowPopover（Description 列）
- [x] 2.4 Pipelines.tsx 升级分页配置（showSizeChanger、pageSizeOptions、showTotal）

## 3. DataSources 页面升级

- [x] 3.1 DataSources.tsx 添加搜索栏（Input.Search，按 name 过滤）、客户端搜索状态和过滤逻辑
- [x] 3.2 DataSources.tsx 添加列排序（Name、Type、Status、Created At 列 sorter）
- [x] 3.3 DataSources.tsx 切换到 tableLayout="fixed"，添加 ResizableTitle、列宽 state、OverflowPopover（Name 列）

## 4. Targets 页面升级

- [x] 4.1 Targets.tsx 添加搜索栏（Input.Search，按 name 过滤）、客户端搜索状态和过滤逻辑
- [x] 4.2 Targets.tsx 添加列排序（Name、Type、Status、Created At 列 sorter）
- [x] 4.3 Targets.tsx 切换到 tableLayout="fixed"，添加 ResizableTitle、列宽 state、OverflowPopover（Name 列）
- [x] 4.4 Targets.tsx 添加分页配置（当前无分页），使用标准配置（showSizeChanger、pageSizeOptions、showTotal）

## 5. Connections 页面升级

- [x] 5.1 Connections.tsx 添加搜索栏（Input.Search，按 name/description 过滤）、客户端搜索状态和过滤逻辑
- [x] 5.2 Connections.tsx 添加列排序（Name、Type、Created At 列 sorter）
- [x] 5.3 Connections.tsx 切换到 tableLayout="fixed"，添加 ResizableTitle、列宽 state、OverflowPopover（Description、Endpoint/Details 列）

## 6. RunHistory 页面升级

- [x] 6.1 RunHistory.tsx 添加列宽定义、tableLayout="fixed"、标准分页配置（当前为占位页，仅做结构准备）

## 7. 验证

- [x] 7.1 运行 `npx tsc -b` 确保 TypeScript 编译通过
- [x] 7.2 运行 `npm run build` 确保 Vite 构建成功
