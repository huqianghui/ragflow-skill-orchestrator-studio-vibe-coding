## ADDED Requirements

### Requirement: Table columns SHALL support drag-to-resize

The Skill Library table SHALL allow users to resize designated columns by dragging the column header border. Resizable columns are Name and Description. Other columns SHALL remain fixed width.

#### Scenario: User drags Description column border to make it wider
- **WHEN** user drags the right border of the Description column header to the right
- **THEN** the Description column width SHALL increase accordingly
- **AND** the table layout SHALL adjust without breaking

#### Scenario: User drags Name column border to make it narrower
- **WHEN** user drags the right border of the Name column header to the left
- **THEN** the Name column width SHALL decrease but NOT below 100px minimum width

#### Scenario: Description column has minimum width constraint
- **WHEN** user attempts to drag the Description column narrower than 150px
- **THEN** the column width SHALL stop at 150px and NOT shrink further

#### Scenario: Non-resizable columns are not draggable
- **WHEN** user hovers over the Type, Built-in, Created At, or Actions column headers
- **THEN** no drag handle SHALL appear and the column width SHALL remain fixed
