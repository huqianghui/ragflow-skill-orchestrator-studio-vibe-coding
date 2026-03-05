# Output Targets Module Specification

## Overview

输出目标模块负责管理 Pipeline 处理完成后的数据写入目标。Phase 1 支持 Azure AI Search Index，Phase 2 扩展支持 MySQL、PostgreSQL、CosmosDB、Neo4j。

---

## REQ-TGT-001: Target Data Model

**Requirement:** 系统应维护输出目标的完整数据模型。

### Scenario: Target 基本结构

```
GIVEN 用户查看 Target 详情
THEN Target 应包含以下字段:
  - id (唯一标识)
  - name (显示名称)
  - description (描述, 可选)
  - target_type (azure_ai_search | mysql | postgresql | cosmosdb | neo4j)
  - status (active | inactive | error)
  - connection_config (连接配置, 加密存储)
  - field_mappings (字段映射配置)
  - pipeline_id (关联 Pipeline, 可选)
  - created_at / updated_at
  - last_write_at (最后写入时间) [Phase 2]
```

---

## REQ-TGT-002: Azure AI Search Index 配置

**Requirement:** 用户可以配置 Azure AI Search 作为输出目标 (Phase 1)。

### Scenario: 配置 Azure AI Search 连接

```
GIVEN 用户创建新的输出目标
WHEN 用户选择类型 "Azure AI Search" 并填写:
  - service_name (Azure AI Search 服务名)
  - api_key (管理 API Key)
  - index_name (目标索引名)
THEN 系统验证连接有效性
AND 如果索引存在，获取其 schema
AND 如果索引不存在，提示可选择自动创建
```

### Scenario: 连接验证

```
GIVEN 用户填写了 Azure AI Search 配置
WHEN 系统验证连接
THEN 检查:
  - service_name 可达
  - api_key 有效
  - api_key 具有索引读写权限
AND 验证成功显示 "连接成功"
AND 验证失败显示具体错误
```

### Scenario: 自动创建索引

```
GIVEN 目标 index_name 不存在
AND 用户选择 "自动创建索引"
WHEN 系统创建索引
THEN 根据 Pipeline 最终输出的 schema 生成索引字段定义
AND 创建索引
AND 显示创建成功
```

---

## REQ-TGT-003: 字段映射

**Requirement:** 用户可以配置 Pipeline 输出字段到目标存储字段的映射关系。

### Scenario: 配置字段映射

```
GIVEN 用户配置 Target 的字段映射
WHEN 目标索引有以下字段: [id, content, title, embedding, metadata]
AND Pipeline 输出有以下字段: [doc_id, text, doc_title, vector, extra_info]
THEN 用户可以配置映射:
  - doc_id → id
  - text → content
  - doc_title → title
  - vector → embedding
  - extra_info → metadata
```

### Scenario: 自动映射建议

```
GIVEN 用户打开字段映射配置
WHEN Pipeline 输出字段名与目标字段名相似
THEN 系统自动建议映射:
  - 完全匹配: "content" → "content"
  - 近似匹配: "text" → "content" (建议)
AND 用户可以接受或修改建议
```

### Scenario: 映射验证

```
GIVEN 用户配置了字段映射
WHEN 用户点击 "验证映射"
THEN 系统检查:
  - 目标必需字段都有映射来源
  - 类型兼容 (如 vector 字段需要数组类型)
  - key 字段已映射
AND 验证通过显示 "映射有效"
AND 验证失败显示具体错误
```

---

## REQ-TGT-004: 数据写入

**Requirement:** Pipeline 执行完成后，系统将最终结果写入目标。

### Scenario: 写入 Azure AI Search

```
GIVEN Pipeline 执行完成，产出 N 条结果文档
WHEN 系统写入 Azure AI Search
THEN 按批次上传 (每批最多 1000 条)
AND 使用 merge-or-upload 策略
AND 记录写入成功/失败数量
AND 失败的文档记录错误详情
```

### Scenario: 写入失败重试

```
GIVEN 某批次写入 Azure AI Search 失败
WHEN 失败原因为网络超时或 429 限流
THEN 系统自动重试 (最多 3 次, 指数退避)
AND 重试成功则继续
AND 重试全部失败则标记该批次为失败并记录
```

---

## REQ-TGT-005: Target CRUD

**Requirement:** 用户可以管理输出目标的完整生命周期。

### Scenario: 列出 Target

```
GIVEN 用户访问输出目标页面
WHEN 页面加载
THEN 显示所有 Target:
  - 名称、类型、状态
  - 最后写入时间
  - 关联的 Pipeline 数量
```

### Scenario: 测试连接

```
GIVEN 一个已保存的 Target
WHEN 用户点击 "测试连接"
THEN 系统尝试连接目标存储
AND 返回连接状态和延迟信息
```

### Scenario: 删除 Target

```
GIVEN 一个 Target 未被任何 Pipeline 绑定
WHEN 用户点击删除
THEN 系统删除 Target 配置
AND 不影响目标存储中已有数据
```
