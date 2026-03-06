# Python Code Skill 执行框架与 Connection 管理

## 变更编号

`python-skill-execution`

## 问题描述

Azure AI Search 的 custom skill 需要运行在 Azure Function 上，与 AI Search 服务割裂，开发调试体验差。具体痛点：

1. **开发割裂**：用户写完 Python 代码后，必须部署到 Azure Function 才能测试，无法在平台内闭环完成开发-测试-上线。
2. **缺少代码编辑与执行能力**：当前 Skill 模型虽定义了 `python_code` 类型，但没有存储代码、执行代码的能力。
3. **凭据管理缺失**：Custom skill 通常需要调用 Azure OpenAI、Document Intelligence 等 AI 服务，当前没有统一的 Connection/Credential 管理，用户不得不在代码中硬编码 API Key。
4. **调试困难**：无法用样本数据快速验证 skill 逻辑，每次修改都需要重新部署。

## 解决方案

### 1. Connection 管理模块（新模块）

独立的连接/凭据管理模块，集中存储 Azure AI 服务的 endpoint 和 credential：

- 支持多种连接类型：Azure OpenAI、OpenAI、Azure Document Intelligence、Azure Content Understanding、Azure AI Foundry、通用 HTTP API
- Connection 配置加密存储，创建后 secret 字段仅显示掩码
- 提供连接测试能力（test connection）
- Connection 可被多个 Skill 引用复用

### 2. Skill 模型扩展

为 `python_code` 类型的 Skill 增加专用字段：

- `source_code`：用户编写的 `process(data, context)` 函数代码
- `additional_requirements`：额外 pip 依赖（一行一个）
- `test_input`：用户保存的测试数据 JSON
- `connection_mappings`：Skill 引用的 Connection 映射

### 3. SkillContext 运行时上下文

提供 `SkillContext` 对象供用户代码访问：

- `context.get_client(name)` — 获取已认证的 Azure AI SDK 客户端实例
- `context.config` — Skill 配置参数
- `context.logger` — 安全的日志对象

用户只需编写单条记录处理函数，框架负责循环遍历所有记录：

```python
def process(data: dict, context) -> dict:
    client = context.get_client("llm")
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": data["text"]}]
    )
    return {"summary": response.choices[0].message.content}
```

### 4. 执行引擎

- 服务端通过 subprocess 在隔离进程中执行用户代码
- 预置基础虚拟环境（标准库 + Azure AI SDK + 常用工具包）
- 有 additional requirements 的 Skill 在创建/更新时生成独立虚拟环境
- 超时控制（默认 60s）、执行日志收集

### 5. Skill Editor UI

浏览器内代码编辑与测试体验：

- 代码编辑器（Monaco Editor）分三个区域：预置 imports（只读）、additional requirements（可编辑）、用户代码（可编辑）
- 测试面板：输入 sample JSON → 点击运行 → 查看输出结果/错误/日志
- 测试数据来源：手动输入 JSON，或从 Pipeline 测试运行的中间结果导入
- 测试通过后一键保存为 Custom Skill

### 6. 预置包清单

标准库：re, json, math, datetime, collections, hashlib, urllib.parse, csv, io, base64, logging, typing

三方包：
- HTTP：requests, httpx
- Azure：azure-identity, openai, azure-ai-documentintelligence, azure-ai-contentsafety, azure-ai-projects, azure-ai-inference
- 数据处理：pydantic

## 影响范围

| 维度 | 说明 |
|------|------|
| 新模块 | Connection 管理（Model + CRUD API + UI） |
| 数据库 | 新增 `connections` 表；`skills` 表新增 `source_code`、`additional_requirements`、`test_input`、`connection_mappings` 字段 |
| API 层 | 新增 Connection CRUD API；新增 Skill 测试执行 API (`POST /api/v1/skills/{id}/test`) |
| 后端服务 | 新增 SkillContext、SkillRunner、VenvManager 服务类 |
| 前端 | 新增 Connection 管理页面；Skill 创建/编辑页改为代码编辑器 + 测试面板 |
| 依赖 | 后端新增 Azure AI SDK 包；前端新增 Monaco Editor |
| 安全 | Connection secret 加密存储；subprocess 隔离执行用户代码；超时控制 |

## 与其他变更的关系

- 依赖已完成的 `skill-management`（Skill CRUD）和 `init-project-foundation`（基础架构）
- 为后续 `pipeline-orchestration` Phase 2 的执行引擎提供 Python Skill 执行能力
- 与 `datasource-and-execution` 中的中间结果管理联动：Pipeline 测试运行的中间结果可作为 Skill 测试输入
