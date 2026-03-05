# Runs & Execution Module Specification

## Overview

运行模块负责 Pipeline 的执行引擎、任务管理、步骤可观测性、中间结果管理和日志记录。支持同步（小文件快速测试）和异步（大批量生产）两种执行模式。

---

## REQ-RUN-001: Run Data Model

**Requirement:** 系统应维护完整的运行记录数据模型。

### Scenario: Run 基本结构

```
GIVEN 用户查看 Run 详情
THEN Run 应包含以下字段:
  - id (唯一标识)
  - pipeline_id (关联 Pipeline)
  - datasource_id (输入数据源)
  - target_id (输出目标)
  - status (pending | running | completed | failed | cancelled)
  - mode (sync | async)
  - started_at / finished_at
  - total_documents (总文档数)
  - processed_documents (已处理数)
  - failed_documents (失败数)
  - error_message (顶层错误, 如有)
  - metrics (运行指标, JSON, 可选)
AND 每个 Run 包含多个 StepResult [Phase 2]:
  - id
  - run_id
  - node_id (Pipeline 节点)
  - document_id (处理的文档)
  - status (pending | running | completed | failed | skipped)
  - input_data (步骤输入, JSON)
  - output_data (步骤输出, JSON)
  - error_message
  - started_at / finished_at
  - duration_ms
```

---

## REQ-RUN-002: 同步执行

**Requirement:** 用户可以同步执行 Pipeline 处理少量文档，用于快速测试和调试。

### Scenario: 同步执行单个文档

```
GIVEN 一个已验证的 Pipeline
AND 选择了一个数据源中的单个文件
WHEN 用户点击 "测试运行"
THEN 系统以同步模式执行 Pipeline
AND 实时显示每个节点的处理状态 (进行中/完成/失败)
AND 执行完成后显示最终结果
AND 整个过程在单个请求-响应周期内完成
```

### Scenario: 同步执行超时

```
GIVEN 同步执行超过 5 分钟
WHEN 超时发生
THEN 系统终止执行
AND 返回已完成步骤的结果
AND 标记 Run 状态为 failed，error_message = "同步执行超时"
```

---

## REQ-RUN-003: 异步执行

**Requirement:** 用户可以异步执行 Pipeline 处理大批量文档。

### Scenario: 启动异步执行

```
GIVEN 一个已验证的 Pipeline
AND 选择了数据源（含多个文件）
WHEN 用户点击 "开始运行"
THEN 系统创建异步任务
AND 返回 Run ID
AND 在后台逐文档处理
AND 用户可以离开页面，稍后查看进度
```

### Scenario: 查看异步执行进度

```
GIVEN 一个异步 Run 正在执行
WHEN 用户打开 Run 详情页
THEN 显示:
  - 进度条: processed_documents / total_documents
  - 当前处理的文档名
  - 每个已完成文档的结果摘要
  - 实时日志流
```

### Scenario: 取消异步执行

```
GIVEN 一个异步 Run 正在执行
WHEN 用户点击 "取消"
THEN 系统停止处理新文档
AND 等待当前文档处理完成
AND 标记 Run 状态为 cancelled
AND 保留已处理文档的结果
```

---

## REQ-RUN-004: 步骤可观测性

**Requirement:** 用户可以查看 Pipeline 执行过程中每个步骤的输入、输出和状态。

### Scenario: 查看步骤详情

```
GIVEN 一个 Run 已完成（或正在运行）
WHEN 用户选择一个文档的处理记录
THEN 显示该文档经过的每个 Pipeline 节点:
  - 节点名称和 Skill 类型
  - 执行状态 (成功/失败/跳过)
  - 输入数据 (可展开查看完整 JSON)
  - 输出数据 (可展开查看完整 JSON)
  - 执行耗时
  - 错误信息 (如有)
```

### Scenario: 步骤失败处理

```
GIVEN Pipeline 执行中某个节点处理某文档失败
WHEN 失败发生
THEN 系统记录错误信息到 StepResult
AND 该文档标记为 failed
AND 继续处理其他文档 (不中断整个 Run)
AND failed_documents 计数 +1
```

---

## REQ-RUN-005: 中间结果管理

**Requirement:** 系统保留 Pipeline 每一步的中间结果，支持查看、删除和定期清理。

### Scenario: 查看中间结果

```
GIVEN 一个已完成的 Run
WHEN 用户点击某个步骤的输出
THEN 显示该步骤的输出数据
AND 支持 JSON 格式化查看
AND 支持大文本的折叠/展开
```

### Scenario: 删除单个 Run 的中间结果

```
GIVEN 一个已完成的 Run
WHEN 用户点击 "清除中间结果"
THEN 系统删除该 Run 所有 StepResult 的 input_data 和 output_data
AND 保留 StepResult 的元数据 (状态、耗时等)
AND 释放存储空间
```

### Scenario: 定期清理策略

```
GIVEN 系统管理员配置了清理策略
WHEN 清理策略为 "保留最近 7 天"
THEN 系统每日自动清理 7 天前的 Run 中间结果
AND 清理前记录日志
AND 不删除标记为 "保留" 的 Run
```

---

## REQ-RUN-006: 运行日志

**Requirement:** 系统记录 Pipeline 执行的详细日志。

### Scenario: 查看运行日志

```
GIVEN 一个 Run（运行中或已完成）
WHEN 用户打开日志面板
THEN 显示结构化日志:
  - 时间戳
  - 日志级别 (INFO | WARN | ERROR)
  - 节点名称
  - 消息内容
AND 支持按级别筛选
AND 支持关键词搜索
AND 运行中的 Run 支持实时日志流 (WebSocket/SSE)
```

---

## REQ-RUN-007: Run 历史管理

**Requirement:** 用户可以查看和管理 Pipeline 的运行历史。

### Scenario: 查看运行历史

```
GIVEN 用户访问某个 Pipeline 的运行历史
WHEN 页面加载
THEN 显示该 Pipeline 所有 Run 记录:
  - Run ID
  - 状态
  - 开始/结束时间
  - 文档数 (总/成功/失败)
  - 执行模式 (同步/异步)
AND 按时间倒序排列
```

### Scenario: 重新运行

```
GIVEN 一个已完成或失败的 Run
WHEN 用户点击 "重新运行"
THEN 系统使用相同的 Pipeline、数据源、目标创建新 Run
AND 开始执行
```
