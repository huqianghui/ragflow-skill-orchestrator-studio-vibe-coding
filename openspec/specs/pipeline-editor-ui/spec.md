# Pipeline Editor UI Module Specification

## Purpose

Pipeline Editor UI 提供 Pipeline 的前端编辑器界面，包括列表页 CRUD 交互、Edit 模式（有序 Skill 节点编排）和 Debug 模式（3 列调试布局）。

### Requirement: Pipeline 列表页 CRUD 交互

系统 SHALL 将 Pipeline 列表页连接到真实 API，支持完整的 CRUD 操作。

#### Scenario: 加载 Pipeline 列表

- **WHEN** 用户访问 /pipelines
- **THEN** 调用 GET /api/v1/pipelines 获取分页数据
- **AND** 显示表格: Name / Status (Tag) / Description / Created / Actions
- **AND** 支持分页导航

#### Scenario: 新建 Pipeline

- **WHEN** 用户点击 "New Pipeline" 按钮
- **THEN** 显示创建对话框，包含:
  - Name 输入框（必填）
  - Description 输入框（可选）
  - 模板选择器（可选，从预置模板中选择）
- **AND** 提交后调用 POST /api/v1/pipelines
- **AND** 成功后跳转到 /pipelines/{id}/edit

#### Scenario: 从模板创建 Pipeline

- **WHEN** 用户在创建对话框中选择模板
- **THEN** graph_data 自动填充为模板的节点定义
- **AND** 创建成功后 Pipeline 已包含预配置的节点

#### Scenario: 编辑 Pipeline

- **WHEN** 用户点击 Actions 中的 "Edit" 按钮
- **THEN** 跳转到 /pipelines/{id}/edit

#### Scenario: 删除 Pipeline

- **WHEN** 用户点击 Actions 中的 "Delete" 按钮
- **THEN** 显示确认对话框
- **AND** 确认后调用 DELETE /api/v1/pipelines/{id}
- **AND** 刷新列表

---

### Requirement: Pipeline 编辑器——Edit 模式

系统 SHALL 提供 Pipeline 编辑器的 Edit 模式，以有序列表方式编排 Skill 节点。

#### Scenario: 页面布局

- **WHEN** 用户访问 /pipelines/{id}/edit
- **THEN** 显示顶部栏: Back 按钮 + Pipeline 名称 + 模式切换 [Edit | Debug] + Save 按钮
- **AND** 默认进入 Edit 模式

#### Scenario: 显示 Skill 节点列表

- **GIVEN** Pipeline 的 graph_data.nodes 有 3 个节点
- **WHEN** 进入 Edit 模式
- **THEN** 按 position 顺序显示 3 个可折叠的 Skill 节点卡片
- **AND** 每个卡片显示: 序号 + Skill 名称 + 类型标签 + 操作按钮 (⚙配置/✕删除/≡拖拽)

#### Scenario: Skill 节点卡片展开内容

- **WHEN** 用户展开一个 Skill 节点卡片
- **THEN** 显示:
  - **Connection**: 若 skill.required_resource_types 不为 null，显示 Connection 下拉框（筛选匹配类型）；若为 null，显示 "本地执行" 标签
  - **Context**: 可编辑的 context 路径下拉框（"/document" 或 "/document/xxx/*"）
  - **Inputs**: 每个 input 映射: name 标签 + source 路径下拉框
  - **Outputs**: 每个 output 映射: name 标签 + targetName 输入框
  - **Config Overrides**: 基于 skill.config_schema 自动生成的表单（复用 BuiltinSkillEditor 的表单生成逻辑）

#### Scenario: Source 路径智能下拉

- **GIVEN** 节点位于列表第 3 位
- **WHEN** 用户点击该节点的 source 路径下拉框
- **THEN** 显示所有可用路径:
  - 初始路径: `/document/file_content`, `/document/file_name`
  - 第 1 个节点的所有输出路径
  - 第 2 个节点的所有输出路径
- **AND** 若前序节点有 `/*` context，其输出路径也带 `/*`（如 `/document/chunks/*/embedding`）

#### Scenario: 添加 Skill 节点

- **WHEN** 用户点击 "+ 添加 Skill" 按钮
- **THEN** 显示 Skill 选择弹窗（Modal），列出所有可用 Skill
- **AND** Skill 按类型分组: Built-in / Custom
- **AND** 每个 Skill 显示: 名称 + 描述 + 所需连接类型
- **AND** 选择后，新节点以 pipeline_io 默认值添加到列表末尾

#### Scenario: 删除 Skill 节点

- **WHEN** 用户点击节点卡片的 ✕ 按钮
- **THEN** 显示确认提示
- **AND** 确认后从列表中移除该节点
- **AND** 后续节点的 position 自动重新编号

#### Scenario: 拖拽排序 Skill 节点

- **WHEN** 用户通过 ≡ 拖拽手柄拖动节点
- **THEN** 可以重新排列节点顺序
- **AND** position 自动重新编号
- **AND** 拖拽后如有 source 路径引用了被移到后面的节点输出，显示警告

#### Scenario: 保存 Pipeline

- **WHEN** 用户点击 "Save" 按钮
- **THEN** 收集所有节点的当前配置，构建 graph_data
- **AND** 调用 PUT /api/v1/pipelines/{id} 更新
- **AND** 显示成功提示

---

### Requirement: Pipeline 编辑器——Debug 模式

系统 SHALL 提供 Pipeline 编辑器的 Debug 模式，参照 Azure AI Search Debug Session 的 3 列布局。

#### Scenario: 切换到 Debug 模式

- **WHEN** 用户点击模式切换中的 "Debug"
- **THEN** 切换为 3 列布局:
  - 左栏 (~200px): 文件上传 + Skill 执行状态列表
  - 中栏 (flex): Enrichment Data Tree 树形浏览器
  - 右栏 (~400px): 选中节点的 Input/Output 详情

#### Scenario: 文件上传

- **WHEN** 用户在左栏上传文件（拖放或选择）
- **THEN** 调用 POST /api/v1/skills/upload-test-file 上传到临时存储
- **AND** 显示已上传文件名和大小
- **AND** "运行" 按钮变为可用

#### Scenario: 执行 Debug 运行

- **WHEN** 用户点击 "▶ 运行" 按钮
- **THEN** 调用 POST /api/v1/pipelines/{id}/debug (携带文件)
- **AND** 显示 loading 状态，Skill 列表各节点显示 ⏳ 待执行状态
- **AND** 执行完成后:
  - 成功的节点显示 ✅ + 耗时
  - 失败的节点显示 ❌ + 错误信息
  - 未执行的节点显示 ⬜
  - 底部显示总耗时和完成比例

#### Scenario: Enrichment Data Tree 显示

- **WHEN** Debug 执行完成
- **THEN** 中栏显示 Enrichment Tree 的可展开树形结构
- **AND** 树节点类型图标:
  - 📝 字符串值
  - 🔢 数字值
  - 📦 数组（显示元素数量）
  - 📁 对象（可展开）
  - 🔗 向量/大数组（截断显示）
- **AND** 标量值直接显示在节点旁（如 `language: "zh"`）
- **AND** 长字符串截断显示前 100 个字符 + "..."

#### Scenario: 点击树节点查看详情

- **WHEN** 用户点击 Enrichment Tree 中的任意节点
- **AND** 该节点是某个 Skill 的输出
- **THEN** 右栏自动切换到产生该输出的 Skill 节点详情
- **AND** 显示该 Skill 的 Input/Output snapshot

#### Scenario: 点击 Skill 状态列表查看详情

- **WHEN** 用户点击左栏 Skill 列表中的某个节点
- **THEN** 右栏显示该节点的详细信息:
  - Skill 名称和状态
  - 执行耗时
  - 处理记录数
  - Input 数据（JSON 格式，可展开）
  - Output 数据（JSON 格式，可展开）
  - 错误信息（如有）

#### Scenario: 扇出节点的详情显示

- **GIVEN** 节点 context 为 `/document/chunks/*`，处理了 3 条记录
- **WHEN** 用户在右栏查看该节点详情
- **THEN** 显示 3 个记录的 Input/Output，支持切换查看（Tab 或列表）
- **AND** 每条记录显示: recordId + Input snapshot + Output snapshot
