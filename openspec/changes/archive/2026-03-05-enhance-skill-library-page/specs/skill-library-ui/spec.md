## ADDED Requirements

### Requirement: Table column sorting
The Skill Library table SHALL support client-side sorting on Name, Type, Built-in, and Created At columns. Clicking a column header SHALL toggle between ascending, descending, and no sort order.

#### Scenario: Sort by name ascending
- **WHEN** user clicks the "Name" column header once
- **THEN** the table rows SHALL be sorted by name in ascending alphabetical order

#### Scenario: Sort by name descending
- **WHEN** user clicks the "Name" column header twice
- **THEN** the table rows SHALL be sorted by name in descending alphabetical order

#### Scenario: Clear sort
- **WHEN** user clicks the "Name" column header a third time
- **THEN** the sort SHALL be cleared and rows return to default order

### Requirement: Skill type icon display
Each skill row SHALL display an icon corresponding to its skill_type in the Name or Type column. The icon mapping SHALL be: builtin → ToolOutlined, web_api → ApiOutlined, config_template → SettingOutlined, python_code → CodeOutlined.

#### Scenario: Display icon for builtin skill
- **WHEN** a skill with skill_type "builtin" is rendered in the table
- **THEN** a ToolOutlined icon SHALL be displayed next to or within the Type column

#### Scenario: Display icon for web_api skill
- **WHEN** a skill with skill_type "web_api" is rendered in the table
- **THEN** an ApiOutlined icon SHALL be displayed next to or within the Type column

### Requirement: Skill detail view
Users SHALL be able to view the full details of any skill in a Modal dialog. The detail view SHALL display: name, description, skill_type, is_builtin status, config_schema (as formatted JSON), created_at, and updated_at.

#### Scenario: Open skill detail modal
- **WHEN** user clicks the "View" action button on a skill row
- **THEN** a Modal SHALL open displaying all skill fields including config_schema as formatted JSON

#### Scenario: Close skill detail modal
- **WHEN** user clicks the close button or outside the detail Modal
- **THEN** the Modal SHALL close

### Requirement: Create new skill
Users SHALL be able to create a new custom skill via a form Modal. The form SHALL include fields for: name (required), description, skill_type (select from web_api, config_template, python_code), and config_schema (JSON text input). On successful submission, the skill list SHALL refresh.

#### Scenario: Open create skill form
- **WHEN** user clicks the "New Skill" button
- **THEN** a Modal with a skill creation form SHALL open

#### Scenario: Submit valid skill
- **WHEN** user fills all required fields with valid data and clicks submit
- **THEN** the system SHALL call POST /api/v1/skills and refresh the skill list on success

#### Scenario: Submit invalid JSON in config_schema
- **WHEN** user enters invalid JSON in the config_schema field and clicks submit
- **THEN** the form SHALL display a validation error and NOT submit

### Requirement: Edit custom skill
Users SHALL be able to edit non-builtin skills via a form Modal pre-filled with current values. On successful submission, the skill list SHALL refresh.

#### Scenario: Open edit form for custom skill
- **WHEN** user clicks the "Edit" action button on a non-builtin skill
- **THEN** a Modal with the edit form SHALL open, pre-filled with the skill's current values

#### Scenario: Edit button disabled for builtin skill
- **WHEN** a builtin skill row is displayed
- **THEN** the "Edit" action button SHALL be disabled

#### Scenario: Submit edit successfully
- **WHEN** user modifies fields and clicks submit on the edit form
- **THEN** the system SHALL call PUT /api/v1/skills/{id} and refresh the skill list on success

### Requirement: Search and filter
The page SHALL provide a search input and a type filter dropdown above the table. Search SHALL match against skill name and description. The type filter SHALL allow selecting one or more skill_types to filter by.

#### Scenario: Search by keyword
- **WHEN** user types "document" in the search input
- **THEN** only skills whose name or description contains "document" (case-insensitive) SHALL be displayed

#### Scenario: Filter by type
- **WHEN** user selects "builtin" from the type filter dropdown
- **THEN** only skills with skill_type "builtin" SHALL be displayed

#### Scenario: Combined search and filter
- **WHEN** user types a keyword AND selects a type filter
- **THEN** only skills matching BOTH criteria SHALL be displayed

#### Scenario: Clear filters
- **WHEN** user clears the search input and type filter
- **THEN** all skills SHALL be displayed
