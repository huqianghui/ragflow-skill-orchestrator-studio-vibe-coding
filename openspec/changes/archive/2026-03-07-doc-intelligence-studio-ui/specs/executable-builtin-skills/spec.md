## MODIFIED Requirements

### Requirement: Document Processing Skill (1 个)

- DocumentCracker 默认使用 Azure Content Understanding
- 可切换为 Azure Document Intelligence
- 支持 file_id 输入 (PDF/DOCX/HTML 等)
- Azure Document Intelligence 模式 SHALL 使用 `prebuilt-layout` model + `outputContentFormat=markdown`
- SHALL 返回结构化结果: `markdown`, `text`, `tables` (HTML), `figures`, `selectionMarks`, `pages`, `metadata`

#### Scenario: Document Intelligence 返回富结构化数据

- **WHEN** DocumentCracker 使用 azure_doc_intelligence 连接分析文档
- **THEN** 调用 `prebuilt-layout` model (非 prebuilt-read)
- **AND** 请求参数包含 `outputContentFormat=markdown`
- **AND** 返回结果包含 `markdown` (markdown 格式内容), `text` (纯文本), `tables` (HTML 表格数组), `figures` (图形信息数组), `selectionMarks` (选择标记数组), `pages` (页面元数据), `metadata` (含 pageCount)

### Requirement: Frontend - BuiltinSkillEditor 页面

#### Scenario: 页面布局 (标准 2 栏)

- **WHEN** 用户访问 /skills/{id}/configure (非 DocumentCracker)
- **THEN** 显示两栏布局:
  - 左栏: Skill 描述 (只读) + Resource Binding + Configuration Form
  - 右栏: Test Input (文本/文件上传) + Test Output
- **AND** 顶部显示 Back 按钮、Skill 名称 + "(Built-in)" 标签、Save 按钮

#### Scenario: Document Intelligence Studio 布局 (3 栏)

- **WHEN** 用户访问 /skills/{id}/configure (DocumentCracker)
- **THEN** 显示 3 栏 Document Intelligence Studio 布局:
  - 左栏 (~160px): 文件上传拖放区 + 已上传文件缩略图 (图片 img、PDF 缩放 iframe、其他文件 icon)
  - 中栏 (flex): 文档预览 (PDF iframe / 图片 img)
  - 右栏 (~480px): 分页输出面板
    - 一级 Tab: Content | Result JSON
    - Content 下二级 Tab: Markdown | Text | Tables | Figures | Selection marks
    - Markdown Tab: 使用 react-markdown + rehype-raw 渲染 (支持 HTML table/figure 标签)
    - Text Tab: 带行号的纯文本
    - Tables Tab: 渲染 HTML 表格
    - Figures Tab: figure caption + bounding region 列表
    - Selection marks Tab: checkbox + 状态 + 置信度
- **AND** 顶部显示 Back 按钮、Skill 名称 + Built-in 标签、齿轮 (配置) 按钮、Save 按钮
- **AND** 配置面板 (Resource Binding + Configuration Form) 通过齿轮按钮折叠/展开
- **AND** 文件上传支持拖放 (drag & drop)

#### Scenario: 文件缩略图显示

- **WHEN** 用户上传文件后
- **THEN** 左栏显示文件缩略图:
  - 图片文件 (png/jpg/gif/webp/svg/tiff): 显示 `<img>` 缩略图 (120x100, object-fit contain)
  - PDF 文件: 显示缩放的 `<iframe>` 缩略图 (120x100 容器, 内容缩放至 33%)
  - 其他文件: 显示文件图标 (FileOutlined)
- **AND** 缩略图下方显示文件名

## ADDED Requirements

### Requirement: 文件预览端点

系统 SHALL 提供文件预览端点，用于在 iframe 或 img 标签中显示已上传的临时文件。

#### Scenario: 获取已上传文件用于预览

- **WHEN** GET /api/v1/skills/test-file/{file_id}
- **THEN** 返回已上传文件的原始内容
- **AND** Content-Type 与上传时一致
- **AND** 使用 RFC 5987 `filename*=UTF-8''` 编码支持非 ASCII 文件名 (中文、日文等)

#### Scenario: 文件不存在

- **WHEN** GET /api/v1/skills/test-file/{file_id} 且 file_id 不存在
- **THEN** 返回 404 Not Found

### Requirement: Markdown 富文本渲染

系统 SHALL 正确渲染 Document Intelligence 返回的 markdown 内容，包括嵌入的 HTML 标签。

#### Scenario: 渲染包含 HTML 表格的 markdown

- **WHEN** Document Intelligence 返回的 markdown 包含 `<table>` HTML 标签
- **THEN** Markdown Tab SHALL 将其渲染为可视化表格 (非原始 HTML 文本)
- **AND** 表格具有边框、表头背景色、交替行底色样式

#### Scenario: 渲染包含 figure 的 markdown

- **WHEN** Document Intelligence 返回的 markdown 包含 `<figure>` HTML 标签
- **THEN** Markdown Tab SHALL 将其渲染为带边框的图形区域
- **AND** figcaption 以小字灰色显示
