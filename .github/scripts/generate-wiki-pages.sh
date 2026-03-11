#!/usr/bin/env bash
# Generate dynamic wiki pages from openspec data.
# Called by sync-wiki.yml CI workflow.
#
# Generates:
#   wiki/Changelog.md   — from openspec/changes/archive/
#   wiki/Module-Index.md — updated spec count
#   wiki/Home.md         — updated stats
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
WIKI_DIR="$REPO_ROOT/wiki"
ARCHIVE_DIR="$REPO_ROOT/openspec/changes/archive"
SPECS_DIR="$REPO_ROOT/openspec/specs"

# ── Cross-platform sed -i ─────────────────────────────────────
# macOS sed requires -i '' while GNU sed uses -i
sedi() {
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

# ── Helper: extract title from proposal.md ─────────────────────
extract_title() {
  local dir="$1"
  local proposal="$dir/proposal.md"
  if [ -f "$proposal" ]; then
    local first_line
    first_line=$(head -1 "$proposal")
    if echo "$first_line" | grep -qE '^# '; then
      echo "$first_line" | sed 's/^# *//'
      return
    fi
  fi
  # Fallback: humanize directory name
  local name
  name=$(basename "$dir")
  name=$(echo "$name" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//')
  echo "$name" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g'
}

# ── Count stats ────────────────────────────────────────────────
SPEC_COUNT=$(find "$SPECS_DIR" -name "spec.md" -type f | wc -l | tr -d ' ')
ARCHIVE_COUNT=$(find "$ARCHIVE_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
TEST_COUNT=$(find "$REPO_ROOT/backend/tests" -name "test_*.py" -type f | wc -l | tr -d ' ')
PAGE_COUNT=$(find "$REPO_ROOT/frontend/src/pages" -name "*.tsx" -type f | wc -l | tr -d ' ')
E2E_COUNT=$(find "$REPO_ROOT/frontend/e2e" -name "*.spec.ts" -type f | wc -l | tr -d ' ')
API_COUNT=$(find "$REPO_ROOT/backend/app/api" -name "*.py" -not -name "__init__.py" -not -name "router.py" -type f | wc -l | tr -d ' ')
MODEL_COUNT=$(find "$REPO_ROOT/backend/app/models" -name "*.py" -not -name "__init__.py" -not -name "base.py" -type f | wc -l | tr -d ' ')

echo "Stats: specs=$SPEC_COUNT archives=$ARCHIVE_COUNT tests=$TEST_COUNT pages=$PAGE_COUNT e2e=$E2E_COUNT api=$API_COUNT models=$MODEL_COUNT"

# ── Update Home.md stats ───────────────────────────────────────
if [ -f "$WIKI_DIR/Home.md" ]; then
  sedi "s/- \*\*Backend\*\*: [0-9]* 个 API 模块.*/- **Backend**: ${API_COUNT} 个 API 模块, ${MODEL_COUNT} 个 ORM 模型, ${TEST_COUNT} 个测试文件/" "$WIKI_DIR/Home.md"
  sedi "s/- \*\*Frontend\*\*: [0-9]* 个页面组件.*/- **Frontend**: ${PAGE_COUNT} 个页面组件, ${E2E_COUNT} 个 E2E 测试/" "$WIKI_DIR/Home.md"
  sedi "s/- \*\*Specs\*\*: [0-9]* 个模块规格.*/- **Specs**: ${SPEC_COUNT} 个模块规格, ${ARCHIVE_COUNT} 个已归档变更/" "$WIKI_DIR/Home.md"
  echo "Updated Home.md stats"
fi

# ── Generate Changelog.md ──────────────────────────────────────
CHANGELOG="$WIKI_DIR/Changelog.md"
cat > "$CHANGELOG" << 'HEADER'
# Changelog

已归档变更的时间线。每个变更包含 proposal、design、tasks 完整记录。

> 详细内容见 [`openspec/changes/archive/`](../tree/main/openspec/changes/archive)

---

HEADER

CURRENT_DATE=""
for dir in $(find "$ARCHIVE_DIR" -maxdepth 1 -mindepth 1 -type d | sort -r); do
  dir_name=$(basename "$dir")
  # Extract date (YYYY-MM-DD)
  date_part=$(echo "$dir_name" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
  # Extract change name (after date)
  change_name=$(echo "$dir_name" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//')

  # New date group
  if [ "$date_part" != "$CURRENT_DATE" ]; then
    if [ -n "$CURRENT_DATE" ]; then
      echo "" >> "$CHANGELOG"
    fi
    echo "### $date_part" >> "$CHANGELOG"
    echo "" >> "$CHANGELOG"
    echo "| 变更 | 说明 |" >> "$CHANGELOG"
    echo "|------|------|" >> "$CHANGELOG"
    CURRENT_DATE="$date_part"
  fi

  title=$(extract_title "$dir")
  echo "| [$change_name](../tree/main/openspec/changes/archive/$dir_name) | $title |" >> "$CHANGELOG"
done

TOTAL_ARCHIVES=$(find "$ARCHIVE_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
echo "" >> "$CHANGELOG"
echo "---" >> "$CHANGELOG"
echo "" >> "$CHANGELOG"
echo "> 统计: ${TOTAL_ARCHIVES} 个变更" >> "$CHANGELOG"

echo "Generated Changelog.md ($TOTAL_ARCHIVES archives)"
echo "Done."
