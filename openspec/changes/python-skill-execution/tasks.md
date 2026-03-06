# Python Code Skill 执行框架与 Connection 管理 — 实施任务清单

## 阶段一：Connection 管理模块

### 1.1 后端 - Connection Model & CRUD

- [x] 创建 `Connection` SQLAlchemy 模型（name, connection_type, description, config）
- [x] 创建 Connection Pydantic schemas（ConnectionCreate, ConnectionUpdate, ConnectionResponse）
- [x] ConnectionResponse 中 secret 字段返回掩码值
- [x] 实现 Fernet 加密/解密工具函数（encrypt_config, decrypt_config, mask_config）
- [x] 添加 `SECRET_ENCRYPTION_KEY` 到 Settings 配置
- [x] 实现 Connection CRUD API（POST/GET/PUT/DELETE /api/v1/connections）
- [x] 实现连接测试 API（POST /api/v1/connections/{id}/test）
- [x] 为每种 connection_type 实现测试逻辑
- [x] 编写 Connection CRUD 单元测试
- [x] 编写连接测试 API 测试（mock 外部服务）

### 1.2 前端 - Connection 管理页面

- [x] 添加 `/connections` 路由和左侧导航菜单项
- [x] 实现 Connection 列表页（表格：名称、类型、描述、操作）
- [x] 实现创建 Connection 弹窗（根据 connection_type 动态渲染表单字段）
- [x] 实现编辑 Connection 弹窗（secret 字段为空时不更新）
- [x] 实现删除 Connection 确认弹窗
- [x] 实现测试连接按钮（显示成功/失败结果）

## 阶段二：Skill 模型扩展

### 2.1 后端 - 数据模型扩展

- [x] 在 Skill 模型新增字段：source_code (Text), additional_requirements (Text), test_input (JSON), connection_mappings (JSON)
- [x] 更新 SkillCreate / SkillUpdate / SkillResponse schemas 添加新字段
- [x] 数据库迁移（SQLite create_all 自动处理，但需验证向后兼容）
- [x] 编写模型扩展单元测试

### 2.2 后端 - 预置 Imports API

- [x] 在配置中定义 PRELOADED_IMPORTS 列表（标准库 + 三方包）
- [x] 实现 GET /api/v1/skills/preloaded-imports API
- [x] 编写 API 测试

## 阶段三：SkillContext & 执行引擎

### 3.1 后端 - SkillContext

- [x] 实现 SkillContext 类（config, get_client, logger）
- [x] 实现 ContextLogger 类（info, warning, error，收集日志条目）
- [x] 实现 ClientFactory（根据 connection_type 创建对应 SDK 客户端）
- [x] 支持 azure_openai, openai, azure_doc_intelligence, azure_content_understanding, azure_ai_foundry, http_api 六种类型
- [x] 编写 SkillContext 单元测试（mock SDK 客户端）
- [x] 编写 ClientFactory 单元测试

### 3.2 后端 - SkillRunner

- [x] 实现 SkillRunner 类
- [x] 实现代码编译（PRELOADED_IMPORTS + user source_code → module）
- [x] 实现 values 循环执行（per-record 调用 process 函数）
- [x] 实现错误捕获（单条 record 失败不影响其他）
- [x] 实现执行超时控制（asyncio.wait_for, 默认 60s）
- [x] 实现标准输出格式包装（values + logs + execution_time_ms）
- [x] 编写 SkillRunner 单元测试（纯函数、有 context 调用、异常、超时）

### 3.3 后端 - 测试执行 API

- [x] 实现 POST /api/v1/skills/{id}/test — 已保存 Skill 的测试
- [x] 实现 POST /api/v1/skills/test-code — 未保存代码的临时测试
- [x] 验证 process 函数签名（必须存在 process 函数）
- [x] 返回结构化结果（values, logs, execution_time_ms）
- [x] 编写测试执行 API 集成测试

## 阶段四：虚拟环境管理

### 4.1 后端 - VenvManager

- [x] 在配置中添加 SKILL_VENVS_ROOT 路径设置
- [x] 实现 VenvManager.ensure_base_env()（创建基础环境 + 安装预置包）
- [x] 实现 VenvManager.ensure_skill_env(skill)（有 additional_requirements 时创建独立环境）
- [x] 实现环境清理逻辑（Skill 删除/requirements 变更时清理旧环境）
- [x] 在应用启动时调用 ensure_base_env()
- [x] 在 Skill 创建/更新时调用 ensure_skill_env()
- [x] 编写 VenvManager 单元测试

注：Phase 1 执行引擎在主进程中运行，VenvManager 主要确保 additional requirements 可用。Phase 2 升级为 subprocess 隔离时将使用 venv 的 Python 解释器执行。

## 阶段五：Skill Editor UI

### 5.1 前端 - 编辑器基础

- [x] 添加 `@monaco-editor/react` 依赖
- [x] 实现 SkillEditorPage 页面组件
- [x] 添加 `/skills/{id}/edit` 和 `/skills/new` 路由
- [x] 实现 PreloadedImportsBlock（只读展示，灰底，可折叠）
- [x] 实现 Monaco 代码编辑器（Python 语法高亮、自动补全）
- [x] 预填默认代码模板：`def process(data: dict, context) -> dict:`

### 5.2 前端 - 右侧面板

- [x] 实现 ConnectionMappings 组件（添加/删除连接映射，下拉选择 Connection）
- [x] 实现 RequirementsEditor 组件（多行文本框）
- [x] 实现 TestInputEditor（JSON 编辑器，语法高亮 + 格式化）
- [x] 实现 "Import from Pipeline Test Run" 下拉（列出可用的 Pipeline 运行 + 节点输出）（Phase 2 依赖，已添加 disabled 占位按钮）
- [x] 实现 RunTestButton（调用 POST /skills/{id}/test 或 /skills/test-code）
- [x] 实现 TestOutputViewer（结果 JSON + 日志列表 + 错误高亮）

### 5.3 前端 - 保存与交互

- [x] 实现 Save 按钮（创建或更新 Skill）
- [x] source_code, additional_requirements, test_input, connection_mappings 一起保存
- [x] Skill Library 表格中 python_code 类型的 Skill 点击跳转到 Editor 页面
- [x] 新建 Skill 时 skill_type 选择 python_code 跳转到 Editor 页面
- [x] 未保存更改提示（离开页面时确认）

## 阶段六：集成测试与文档

### 6.1 端到端流程测试

- [x] E2E: 创建 Connection → 创建 Python Skill (引用 Connection) → 测试执行 → 验证输出
- [x] E2E: 修改 source_code → 重新测试 → 更新保存
- [x] E2E: 添加 additional_requirements → 验证环境创建 → 代码中使用额外包
- [x] 错误场景: 无效代码、缺少 process 函数、Connection 不存在、执行超时

### 6.2 文档

- [x] 更新 API 文档（Connection API + Skill 测试 API）
- [x] 编写用户指南：如何创建 Python Code Skill
- [x] 编写预置包使用示例（Azure OpenAI 调用、Document Intelligence 解析等）
