# Pipelines Module Specification

## Overview

Pipeline 是 Skill 的编排容器，定义了数据从输入到输出的完整处理流程。用户可以可视化地构建 Pipeline，添加/排列 Skill 节点，配置节点间的数据映射，并从模板库快速创建。

---

## REQ-PIP-001: Pipeline Data Model

**Requirement:** 系统应维护完整的 Pipeline 数据模型。

### Scenario: Pipeline 基本结构

```
GIVEN 用户查看 Pipeline 详情
THEN Pipeline 应包含以下字段:
  - id (唯一标识)
  - name (显示名称)
  - description (描述)
  - nodes (有序节点列表)
  - edges (节点间连接关系)
  - status (draft | validated | running | completed | failed)
  - created_at / updated_at
  - last_run_at (最后执行时间)
AND 每个 Node 包含:
  - id (节点唯一 ID)
  - skill_id (引用的 Skill)
  - skill_version (Skill 版本)
  - position (画布坐标 x, y)
  - config_overrides (覆盖 Skill 默认配置)
  - input_mappings (输入字段映射)
  - output_mappings (输出字段映射)
AND 每个 Edge 包含:
  - source_node_id
  - source_output_field
  - target_node_id
  - target_input_field
```

---

## REQ-PIP-002: Pipeline CRUD

**Requirement:** 用户可以创建、读取、更新、删除 Pipeline。

### Scenario: 创建空白 Pipeline

```
GIVEN 用户点击 "新建 Pipeline"
WHEN 用户选择 "空白 Pipeline"
THEN 系统创建一个新 Pipeline，status 为 draft
AND 显示空白画布
```

### Scenario: 从模板创建 Pipeline

```
GIVEN 用户点击 "新建 Pipeline"
WHEN 用户选择一个 Pipeline 模板（如 "PDF 文档索引"）
THEN 系统根据模板预填节点和连接
AND 用户可以在此基础上修改
```

### Scenario: 列出 Pipeline

```
GIVEN 用户访问 Pipeline 列表页
WHEN 页面加载
THEN 显示所有 Pipeline，含名称、状态、节点数、最后运行时间
AND 支持按状态筛选和名称搜索
```

### Scenario: 删除 Pipeline

```
GIVEN 一个 Pipeline 当前没有正在运行的任务
WHEN 用户点击删除并确认
THEN 系统删除 Pipeline 及其关联的运行历史
AND 不影响被引用的 Skill

GIVEN 一个 Pipeline 正在运行
WHEN 用户点击删除
THEN 系统提示 "请先停止运行中的任务"
AND 阻止删除
```

---

## REQ-PIP-003: 节点管理

**Requirement:** 用户可以在 Pipeline 画布上添加、移除、连接 Skill 节点。

### Scenario: 添加 Skill 节点

```
GIVEN 用户在 Pipeline 编辑页面
WHEN 从 Skill 面板拖拽一个 Skill 到画布
THEN 画布上创建一个新节点，显示 Skill 名称和图标
AND 节点显示输入/输出端口
```

### Scenario: 连接两个节点

```
GIVEN 画布上有两个节点 A 和 B
WHEN 用户从节点 A 的输出端口拖线到节点 B 的输入端口
THEN 创建一条 Edge 连接
AND 如果输出/输入类型不兼容，显示警告
```

### Scenario: 配置节点参数

```
GIVEN 用户点击画布上的一个节点
WHEN 节点配置面板打开
THEN 显示:
  - Skill 名称和类型
  - 可覆盖的配置参数
  - 输入字段映射（从哪个上游节点/字段获取数据）
  - 输出字段映射
```

### Scenario: 删除节点

```
GIVEN 用户选中一个节点
WHEN 用户按 Delete 键或点击删除按钮
THEN 移除该节点及所有关联的 Edge
```

---

## REQ-PIP-004: Pipeline 模板库

**Requirement:** 系统提供预置的 Pipeline 模板，覆盖常见数据处理场景。

### Scenario: 浏览模板库

```
GIVEN 用户打开 Pipeline 模板库
WHEN 页面加载
THEN 显示预置模板列表:
  - "PDF 文档索引": DocumentCracker → TextSplitter → TextEmbedder
  - "多语言文档处理": DocumentCracker → LanguageDetector → TextTranslator → TextSplitter → TextEmbedder
  - "实体提取与索引": DocumentCracker → TextSplitter → EntityRecognizer → KeyPhraseExtractor
  - "图片分析索引": ImageAnalyzer → TextEmbedder
  - "PII 脱敏处理": DocumentCracker → PII Redactor → TextSplitter → TextEmbedder
AND 每个模板显示描述、包含的 Skill、预览图
```

---

## REQ-PIP-005: Pipeline 验证

**Requirement:** 系统应在执行前验证 Pipeline 的完整性和正确性。

### Scenario: 验证通过

```
GIVEN 一个 Pipeline 包含至少一个节点
AND 所有节点的输入都已连接或有默认值
AND 没有循环依赖
WHEN 用户点击 "验证"
THEN 系统标记 Pipeline 状态为 validated
AND 显示 "验证通过"
```

### Scenario: 验证失败 - 孤立节点

```
GIVEN 一个 Pipeline 中有节点的必需输入未连接
WHEN 用户点击 "验证"
THEN 系统标记失败节点为红色
AND 显示错误: "节点 [name] 的输入 [field] 未连接"
```

### Scenario: 验证失败 - 循环依赖

```
GIVEN 一个 Pipeline 中存在 A → B → C → A 的循环
WHEN 用户点击 "验证"
THEN 系统显示错误: "检测到循环依赖: A → B → C → A"
AND 高亮循环路径
```

### Scenario: 验证失败 - 类型不匹配

```
GIVEN 节点 A 的输出类型为 "image" 连接到节点 B 期望 "text" 的输入
WHEN 用户点击 "验证"
THEN 系统显示警告: "节点 A 输出类型 'image' 与节点 B 输入类型 'text' 不匹配"
```
