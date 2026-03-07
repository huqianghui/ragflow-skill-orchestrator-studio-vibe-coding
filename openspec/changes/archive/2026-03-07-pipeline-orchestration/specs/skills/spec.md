## MODIFIED Requirements

### Requirement: Skill Data Model

Skill 是 Pipeline 中的最小处理单元，对标 Azure AI Skillset 中的 Skill 概念。每个 Skill 接收输入、执行处理逻辑、产出输出。系统支持内置 Skill 和三种自定义 Skill（Web API、配置模板、Python 代码）。

#### Scenario: Skill 字段结构

- **GIVEN** 数据库中存在一个 Skill 记录
- **THEN** 该 Skill 包含以下字段:
  - id (UUID v4 字符串主键)
  - name (显示名称, 最长 255 字符, **唯一约束**)
  - skill_type (builtin | web_api | config_template | python_code)
  - description (功能描述, 可选)
  - config_schema (JSON 对象, 类型相关的配置参数 JSON Schema)
  - is_builtin (布尔值, 是否为内置 Skill)
  - source_code (文本, python_code 类型的用户代码, 可选)
  - additional_requirements (文本, python_code 额外 pip 依赖, 可选)
  - test_input (JSON 对象, python_code 测试输入数据, 可选)
  - connection_mappings (JSON 对象, python_code 连接名→Connection ID 映射, 可选)
  - required_resource_types (JSON 数组, builtin skill 所需连接类型, 可选)
  - bound_connection_id (字符串, 用户绑定的 Connection ID, 可选)
  - config_values (JSON 对象, 用户配置的参数值, 可选)
  - **pipeline_io** (JSON 对象, Pipeline I/O 默认值, 可选) — **新增字段**
  - created_at / updated_at (时间戳, 自动生成)

- **AND** pipeline_io 结构为:
  ```json
  {
    "default_context": "/document",
    "inputs": [
      {"name": "text", "source": "/document/content", "description": "Input text"}
    ],
    "outputs": [
      {"name": "chunks", "targetName": "chunks", "description": "Text chunks array"}
    ]
  }
  ```
- **AND** pipeline_io 为 null 时表示该 Skill 暂不支持在 Pipeline 中使用
- **AND** 所有 16 个内置 Skill 的 pipeline_io 在播种时设置

### Requirement: 内置 Skill 自动播种

系统启动时自动补齐缺失的内置 Skill，幂等操作。

#### Scenario: 系统启动时播种内置 Skill

- **GIVEN** 系统启动
- **WHEN** lifespan 初始化执行 seed_builtin_skills
- **THEN** 比对数据库中已有的 builtin Skill name 集合
- **AND** 仅插入缺失的内置 Skill，不更新已存在的
- **AND** 记录日志: "Seeded N built-in skills"

#### Scenario: 播种数据包含 pipeline_io

- **GIVEN** BUILTIN_SKILLS 定义列表
- **THEN** 每个 Skill 定义包含 `pipeline_io` 字段
- **AND** pipeline_io 包含该 Skill 在 Pipeline 中的默认 context、inputs、outputs 映射
