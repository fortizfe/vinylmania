#!/usr/bin/env bash
# Git extension: create-pr.sh
# Push the current branch and open a pull request via the GitHub CLI (gh).
# Invoked as an optional hook after implementation (or manually at any time).
#
# Usage: create-pr.sh <event_name>
#   e.g.: create-pr.sh after_implement

set -e

EVENT_NAME="${1:-after_implement}"

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

_find_project_root() {
    local dir="$1"
    while [ "$dir" != "/" ]; do
        if [ -d "$dir/.specify" ] || [ -d "$dir/.git" ]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    return 1
}

REPO_ROOT=$(_find_project_root "$SCRIPT_DIR") || REPO_ROOT="$(pwd)"
cd "$REPO_ROOT"

if ! command -v git >/dev/null 2>&1; then
    echo "[specify] Warning: Git not found; skipped PR creation" >&2
    exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[specify] Warning: Not a Git repository; skipped PR creation" >&2
    exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
    echo "[specify] Warning: GitHub CLI (gh) not found; skipped PR creation. Install from https://cli.github.com/" >&2
    exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "[specify] Warning: gh is not authenticated (run 'gh auth login'); skipped PR creation" >&2
    exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
    echo "[specify] Warning: No 'origin' remote configured; skipped PR creation" >&2
    exit 0
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Read auto_pr config (draft / base / title overrides) from git-config.yml
_config_file="$REPO_ROOT/.specify/extensions/git/git-config.yml"
_draft=false
_base=""
_title=""

_extract_yaml_value() {
    # Strip "key:" prefix, then any inline comment (" # ..."), then surrounding quotes.
    local v
    v=$(echo "$1" | sed 's/^[^:]*:[[:space:]]*//')
    v=$(echo "$v" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//')
    if [[ "$v" =~ ^\"(.*)\"$ ]]; then
        v="${BASH_REMATCH[1]}"
    elif [[ "$v" =~ ^\'(.*)\'$ ]]; then
        v="${BASH_REMATCH[1]}"
    fi
    printf '%s' "$v"
}

if [ -f "$_config_file" ]; then
    _in_auto_pr=false
    while IFS= read -r _line; do
        if echo "$_line" | grep -q '^auto_pr:'; then
            _in_auto_pr=true
            continue
        fi
        if $_in_auto_pr && echo "$_line" | grep -Eq '^[a-z]'; then
            break
        fi
        if $_in_auto_pr; then
            if echo "$_line" | grep -Eq '^[[:space:]]+draft:[[:space:]]'; then
                _val=$(_extract_yaml_value "$_line" | tr '[:upper:]' '[:lower:]')
                [ "$_val" = "true" ] && _draft=true
            fi
            if echo "$_line" | grep -Eq '^[[:space:]]+base:[[:space:]]'; then
                _base=$(_extract_yaml_value "$_line")
            fi
            if echo "$_line" | grep -Eq '^[[:space:]]+title:[[:space:]]'; then
                _title=$(_extract_yaml_value "$_line")
            fi
        fi
    done < "$_config_file"
fi

# Resolve base branch: config override -> repo default branch -> "main"
BASE_BRANCH="$_base"
if [ -z "$BASE_BRANCH" ]; then
    BASE_BRANCH=$(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name' 2>/dev/null || true)
fi
[ -z "$BASE_BRANCH" ] && BASE_BRANCH="main"

if [ "$CURRENT_BRANCH" = "$BASE_BRANCH" ]; then
    echo "[specify] Warning: Current branch ('$CURRENT_BRANCH') is the base branch; skipped PR creation" >&2
    exit 0
fi

# Idempotency: skip if a PR already exists for this branch
_existing_url=$(gh pr view "$CURRENT_BRANCH" --json url -q '.url' 2>/dev/null || true)
if [ -n "$_existing_url" ]; then
    echo "[specify] Pull request already exists: $_existing_url" >&2
    exit 0
fi

# Push the branch
_git_out=$(git push -u origin "$CURRENT_BRANCH" 2>&1) || { echo "[specify] Error: git push failed: $_git_out" >&2; exit 1; }

# Derive title/body from feature docs when available
FEATURE_DIR=""
if [ -f "$REPO_ROOT/.specify/scripts/bash/common.sh" ]; then
    # shellcheck source=/dev/null
    . "$REPO_ROOT/.specify/scripts/bash/common.sh"
    _paths=$(get_feature_paths --no-persist 2>/dev/null) || _paths=""
    if [ -n "$_paths" ]; then
        eval "$_paths"
    fi
fi

if [ -z "$_title" ] && [ -n "${FEATURE_SPEC:-}" ] && [ -f "${FEATURE_SPEC:-}" ]; then
    _title=$(grep -m1 -E '^#[[:space:]]+' "$FEATURE_SPEC" | sed -E 's/^#+[[:space:]]*//')
fi
if [ -z "$_title" ]; then
    _title=$(echo "$CURRENT_BRANCH" | sed -E 's/^[0-9]+-//' | tr '-' ' ')
fi

_body="Implements \`$CURRENT_BRANCH\`."
if [ -n "${FEATURE_SPEC:-}" ] && [ -f "${FEATURE_SPEC:-}" ]; then
    _body="${_body}\n\n- Spec: \`${FEATURE_SPEC#"$REPO_ROOT"/}\`"
fi
if [ -n "${TASKS:-}" ] && [ -f "${TASKS:-}" ]; then
    _total=$(grep -Ec '^- \[[ Xx]\]' "$TASKS" 2>/dev/null || echo 0)
    _done=$(grep -Ec '^- \[[Xx]\]' "$TASKS" 2>/dev/null || echo 0)
    _body="${_body}\n- Tasks: ${_done}/${_total} completed"
fi

_gh_args=(pr create --base "$BASE_BRANCH" --head "$CURRENT_BRANCH" --title "$_title" --body "$(printf '%b' "$_body")")
[ "$_draft" = "true" ] && _gh_args+=(--draft)

_pr_out=$(gh "${_gh_args[@]}" 2>&1) || { echo "[specify] Error: gh pr create failed: $_pr_out" >&2; exit 1; }

echo "[OK] Pull request created ($EVENT_NAME): $_pr_out" >&2
