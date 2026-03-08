## 1. 表格列重构

- [x] 1.1 在 `AgentHistory.tsx` 中移除 Title 列定义，替换为 Session ID 列，显示 `native_session_id`（截断前 8 字符 + "..."），`native_session_id` 为 null 时显示灰色斜体 "(pending)"
- [x] 1.2 为 Session ID 列添加 Tooltip（hover 显示完整值）和点击复制功能（`navigator.clipboard.writeText` + message.success 提示 "Copied!"），点击复制时 `stopPropagation` 防止触发行导航
- [x] 1.3 更新搜索逻辑：placeholder 改为 "Search by session ID or agent"，过滤条件从匹配 `title` 改为匹配 `native_session_id`（保留 `agent_name` 匹配）
- [x] 1.4 更新 `colWidths` 状态：移除 `title` key，添加 `sessionId` key，调整默认宽度和 `scroll.x` 计算

## 2. Session Detail Modal

- [x] 2.1 在 `AgentHistory.tsx` 中新增 Session Detail Modal 状态管理：`previewSession`（当前预览的 session）、`previewMessages`（消息列表）、`previewLoading`（加载状态）
- [x] 2.2 实现 Modal 打开逻辑：点击 EyeOutlined 按钮时设置 `previewSession`，调用 `agentApi.getSessionMessages(id)` 加载消息，加载期间显示 Spin
- [x] 2.3 实现 Modal UI：顶部 Descriptions 显示 session 元信息（完整 Session ID + 可复制、Agent、Mode tag、Source tag），中间区域聊天记录列表（role 标签 + Markdown 内容 + 时间戳），底部 "Continue in Playground" 按钮
- [x] 2.4 Actions 列重构：在 DeleteOutlined 前添加 EyeOutlined 按钮，两个按钮均需 `stopPropagation` 防止触发行导航

## 3. 验证与测试

- [x] 3.1 运行 `npx tsc -b` 确保无 TypeScript 编译错误
- [x] 3.2 运行 `npm run build` 确保 Vite 构建通过
- [ ] 3.3 手动验证：打开 Agent History 页面，确认表格列正确显示 Session ID，点击 EyeOutlined 弹出 Modal 并正确加载聊天记录，点击 "Continue in Playground" 正确跳转
