## MODIFIED Requirements

### Requirement: Pipeline 验证

系统 SHALL 提供独立的 Pipeline 验证端点，检查所有节点的 input source 路径是否可从前序节点的输出中解析。

#### Scenario: 验证端点

- **WHEN** POST /api/v1/pipelines/{id}/validate
- **THEN** 返回验证结果: `{valid: bool, errors: [{node_id, node_label, input_name, source, message}]}`
- **AND** 若不存在返回 404 NOT_FOUND

#### Scenario: 验证通过

- **GIVEN** Pipeline 含至少一个节点，所有 source 路径可从前序节点输出或初始路径 (`/document/file_content`, `/document/file_name`) 解析
- **WHEN** POST /api/v1/pipelines/{id}/validate
- **THEN** 返回 `{valid: true, errors: []}`
- **AND** 自动更新 Pipeline status 为 `validated`

#### Scenario: 验证失败 - Source 路径不可用

- **GIVEN** 节点 N 的某个 input source 引用的路径无法从前序节点的输出或初始路径中获得
- **WHEN** POST /api/v1/pipelines/{id}/validate
- **THEN** 返回 `{valid: false, errors: [{node_id, node_label, input_name, source, message: "source path not available from preceding nodes"}]}`
- **AND** 不更新 Pipeline status

#### Scenario: 验证失败 - 空节点

- **GIVEN** Pipeline 的 graph_data.nodes 为空数组
- **WHEN** POST /api/v1/pipelines/{id}/validate
- **THEN** 返回 `{valid: false, errors: [{message: "Pipeline has no nodes"}]}`

#### Scenario: 通配符路径解析

- **GIVEN** 节点 A 输出到 `/document/chunks` (数组)，节点 B context 为 `/document/chunks/*`，input source 为 `/document/chunks/*/text`
- **WHEN** POST /api/v1/pipelines/{id}/validate
- **THEN** 验证通过，因为 `/document/chunks/*/text` 可从节点 A 的数组输出扩展
