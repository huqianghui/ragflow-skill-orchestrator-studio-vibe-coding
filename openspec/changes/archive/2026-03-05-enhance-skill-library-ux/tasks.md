## 1. 依赖安装

- [x] 1.1 安装 `react-resizable` 和 `@types/react-resizable` 到 frontend

## 2. 分页默认值调整

- [x] 2.1 将 `pageSize` 初始值从 50 改为 10
- [x] 2.2 将 `pageSizeOptions` 从 `[20, 50, 100]` 改为 `[10, 20, 50, 100]`

## 3. Name 列可点击链接

- [x] 3.1 将 Name 列 render 改为 link 样式（Typography.Link 或 `<a>` 标签）
- [x] 3.2 点击时根据 `is_builtin` 分流：builtin → `setDetailSkill(record)`, custom → `openEditForm(record)`

## 4. 列拖拽 Resize

- [x] 4.1 引入 `react-resizable` 的 CSS 样式（`react-resizable/css/styles.css`）
- [x] 4.2 创建 `ResizableTitle` 组件，作为自定义 header cell
- [x] 4.3 添加列宽 state，Name 初始 160px（minWidth 100px），Description 初始 350px（minWidth 150px）
- [x] 4.4 在 columns 定义中为 Name 和 Description 设置 `width` 和 `onHeaderCell` 回调
- [x] 4.5 将 `ResizableTitle` 通过 `components={{ header: { cell: ResizableTitle } }}` 传入 Table

## 5. Description 列 Hover Popover

- [x] 5.1 自定义 Description 列 render，用 `<span ref={...}>` 包裹文本并设置 `ellipsis` 样式
- [x] 5.2 实现溢出检测逻辑：`onMouseEnter` 时比较 `scrollWidth > clientWidth`
- [x] 5.3 溢出时渲染 Ant Design `Popover`，`trigger="hover"`，`mouseEnterDelay={0.5}`，纯文本内容，`maxWidth: 400px`

## 6. 验证测试

- [x] 6.1 手动验证：表格默认每页 10 条，分页选项正确
- [x] 6.2 手动验证：点击 builtin skill Name 打开 Detail Modal，点击 custom skill Name 打开 Edit Modal
- [x] 6.3 手动验证：拖拽 Name 和 Description 列头右边缘可调整宽度，有 minWidth 限制
- [x] 6.4 手动验证：长 Description hover 0.5s 后弹出 Popover，短 Description 不弹出
- [x] 6.5 更新 Playwright e2e 测试覆盖 Name 点击行为和分页默认值
