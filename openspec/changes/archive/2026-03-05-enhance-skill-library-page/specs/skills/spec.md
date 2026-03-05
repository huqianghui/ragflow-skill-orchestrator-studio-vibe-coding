## MODIFIED Requirements

### Requirement: Delete skill
The system SHALL allow deletion of any skill, including built-in skills. When a built-in skill is deleted, it SHALL be permanently removed from the database. The skill_seeder SHALL re-create missing built-in skills on application restart.

#### Scenario: Delete a custom skill
- **WHEN** a DELETE request is sent to /api/v1/skills/{id} for a non-builtin skill
- **THEN** the skill SHALL be deleted and a 204 response returned

#### Scenario: Delete a built-in skill
- **WHEN** a DELETE request is sent to /api/v1/skills/{id} for a builtin skill
- **THEN** the skill SHALL be deleted and a 204 response returned

#### Scenario: Delete with confirmation in UI
- **WHEN** user clicks the "Delete" button on a built-in skill in the frontend
- **THEN** a Popconfirm SHALL appear warning that "This is a built-in skill. It will be re-created on next application restart. Continue?"
- **AND WHEN** user confirms
- **THEN** the skill SHALL be deleted and the list refreshed
