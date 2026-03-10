#!/usr/bin/env bash
# Sync OpenSpec changes to GitHub Project V2
#
# State machine:
#   openspec/changes/<name>/                    → Todo (no tasks started)
#   openspec/changes/<name>/ (tasks checked)    → In Progress
#   openspec/changes/archive/<date>-<name>/     → Done
#
# Matching: searches item body for the change name (supports both
# legacy format and new <!-- openspec-change: name --> marker)
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
PROJECT_OWNER="huqianghui"
PROJECT_NUMBER=6
PROJECT_ID="PVT_kwHOAHBQDM4BRVbm"
STATUS_FIELD_ID="PVTSSF_lAHOAHBQDM4BRVbmzg_MWNs"
TODO_OPTION="f75ad846"
IN_PROGRESS_OPTION="47fc9ee4"
DONE_OPTION="98236657"
MARKER_PREFIX="<!-- openspec-change:"

# Map status names to option IDs for comparison
status_to_option() {
  case "$1" in
    Todo)        echo "$TODO_OPTION" ;;
    "In Progress") echo "$IN_PROGRESS_OPTION" ;;
    Done)        echo "$DONE_OPTION" ;;
    *)           echo "" ;;
  esac
}

# ── Helper functions ───────────────────────────────────────────

# Extract a human-readable title from a change directory
extract_title() {
  local dir="$1"
  local proposal="$dir/proposal.md"
  if [ -f "$proposal" ]; then
    local first_line
    first_line=$(head -1 "$proposal")
    # If first line is a top-level heading like "# Title"
    if echo "$first_line" | grep -qE '^# '; then
      echo "$first_line" | sed 's/^# *//'
      return
    fi
  fi
  # Fallback: humanize directory name (strip date prefix, replace dashes)
  local name
  name=$(basename "$dir")
  name=$(echo "$name" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//')
  # Title case: capitalize first letter of each word
  echo "$name" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g'
}

# Determine status of an active change by inspecting tasks.md
detect_active_status() {
  local dir="$1"
  local tasks="$dir/tasks.md"
  if [ -f "$tasks" ]; then
    local done_count
    done_count=$(grep -c '\- \[x\]' "$tasks" 2>/dev/null || echo 0)
    if [ "$done_count" -gt 0 ]; then
      echo "in_progress"
      return
    fi
  fi
  echo "todo"
}

# Find existing project item by change name in body
# Returns: item_id or empty string
find_item_by_change_name() {
  local change_name="$1"
  local items_json="$2"
  echo "$items_json" | jq -r \
    --arg name "$change_name" \
    '.items[] | select(.content.body != null and (.content.body | test($name))) | .id' \
    2>/dev/null | head -1
}

# Get current status option ID of a project item
get_item_status_option() {
  local item_id="$1"
  local items_json="$2"
  local status_name
  status_name=$(echo "$items_json" | jq -r \
    --arg id "$item_id" \
    '.items[] | select(.id == $id) | .status' \
    2>/dev/null | head -1)
  status_to_option "$status_name"
}

# Create a draft issue in the project
create_project_item() {
  local title="$1"
  local change_name="$2"
  local body="${MARKER_PREFIX} ${change_name} -->"

  local item_id
  item_id=$(gh api graphql -f query='
    mutation($projectId: ID!, $title: String!, $body: String!) {
      addProjectV2DraftIssue(input: {
        projectId: $projectId
        title: $title
        body: $body
      }) {
        projectItem { id }
      }
    }
  ' -f projectId="$PROJECT_ID" -f title="$title" -f body="$body" \
    --jq '.data.addProjectV2DraftIssue.projectItem.id')

  echo "$item_id"
}

# Update the Status field of a project item
update_item_status() {
  local item_id="$1"
  local option_id="$2"

  gh api graphql -f query='
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  ' -f projectId="$PROJECT_ID" \
    -f itemId="$item_id" \
    -f fieldId="$STATUS_FIELD_ID" \
    -f optionId="$option_id" > /dev/null
}

# ── Main logic ─────────────────────────────────────────────────
echo "=== Fetching existing project items ==="
ITEMS_JSON=$(gh project item-list "$PROJECT_NUMBER" \
  --owner "$PROJECT_OWNER" \
  --limit 200 \
  --format json 2>/dev/null)

ITEM_COUNT=$(echo "$ITEMS_JSON" | jq '.items | length')
echo "Found $ITEM_COUNT existing items"

# Safety: if we can't fetch items, abort to prevent duplicates
if [ "$ITEM_COUNT" -eq 0 ]; then
  echo "WARNING: Fetched 0 items. This may be a network issue. Aborting to prevent duplicates."
  exit 1
fi

CREATED=0
UPDATED=0

# ── Process active changes (Todo / In Progress) ───────────────
echo ""
echo "=== Processing active changes ==="
if [ -d "openspec/changes" ]; then
  for dir in openspec/changes/*/; do
    [ ! -d "$dir" ] && continue
    dir_name=$(basename "$dir")
    [ "$dir_name" = "archive" ] && continue

    change_name="$dir_name"
    echo "  Active change: $change_name"

    item_id=$(find_item_by_change_name "$change_name" "$ITEMS_JSON")
    status=$(detect_active_status "$dir")

    if [ "$status" = "in_progress" ]; then
      target_option="$IN_PROGRESS_OPTION"
      status_label="In Progress"
    else
      target_option="$TODO_OPTION"
      status_label="Todo"
    fi

    if [ -z "$item_id" ]; then
      # Create new item
      ITEM_COUNT=$((ITEM_COUNT + 1))
      num=$(printf "%02d" "$ITEM_COUNT")
      title=$(extract_title "$dir")
      full_title="$num - $title"

      echo "    Creating: $full_title [$status_label]"
      item_id=$(create_project_item "$full_title" "$change_name")
      if [ -n "$item_id" ]; then
        update_item_status "$item_id" "$target_option"
        CREATED=$((CREATED + 1))
      else
        echo "    ERROR: Failed to create item"
        ITEM_COUNT=$((ITEM_COUNT - 1))
      fi
    else
      # Update status if needed
      current_option=$(get_item_status_option "$item_id" "$ITEMS_JSON")
      if [ "$current_option" != "$target_option" ]; then
        echo "    Updating status -> $status_label"
        update_item_status "$item_id" "$target_option"
        UPDATED=$((UPDATED + 1))
      else
        echo "    Already $status_label, skipping"
      fi
    fi
  done
fi

# ── Process archived changes (Done) ───────────────────────────
echo ""
echo "=== Processing archived changes ==="
if [ -d "openspec/changes/archive" ]; then
  for dir in openspec/changes/archive/*/; do
    [ ! -d "$dir" ] && continue

    archive_name=$(basename "$dir")
    # Strip date prefix: 2026-03-10-name → name
    change_name=$(echo "$archive_name" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//')

    item_id=$(find_item_by_change_name "$change_name" "$ITEMS_JSON")

    if [ -z "$item_id" ]; then
      # Item doesn't exist — create it as Done
      ITEM_COUNT=$((ITEM_COUNT + 1))
      num=$(printf "%02d" "$ITEM_COUNT")
      title=$(extract_title "$dir")
      full_title="$num - $title"

      echo "  Creating Done item: $full_title"
      item_id=$(create_project_item "$full_title" "$change_name")
      if [ -n "$item_id" ]; then
        update_item_status "$item_id" "$DONE_OPTION"
        CREATED=$((CREATED + 1))
      else
        echo "  ERROR: Failed to create item"
        ITEM_COUNT=$((ITEM_COUNT - 1))
      fi
    else
      # Ensure status is Done
      current_option=$(get_item_status_option "$item_id" "$ITEMS_JSON")
      if [ "$current_option" != "$DONE_OPTION" ]; then
        echo "  Marking as Done: $change_name"
        update_item_status "$item_id" "$DONE_OPTION"
        UPDATED=$((UPDATED + 1))
      fi
    fi
  done
fi

# ── Summary ────────────────────────────────────────────────────
echo ""
echo "=== Sync complete ==="
echo "Created: $CREATED items"
echo "Updated: $UPDATED items"
echo "Total items in project: $ITEM_COUNT"
