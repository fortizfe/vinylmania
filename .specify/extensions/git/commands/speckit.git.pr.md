---
description: "Push the current branch and create a GitHub pull request via the GitHub CLI (gh)"
---

# Create Pull Request

Push the current feature branch and open a pull request on GitHub using the `gh` CLI.

## Behavior

This command is typically invoked as an **optional** hook after `/speckit-implement` completes, but can also be run manually at any time. It:

1. Verifies Git, the GitHub CLI (`gh`), and an authenticated `gh` session are available
2. Verifies an `origin` remote is configured
3. Skips (with a warning) if any prerequisite is missing, or if the current branch is already the base branch
4. Skips idempotently if a pull request already exists for the current branch, printing its URL
5. Pushes the current branch to `origin`
6. Derives a title from the feature's `spec.md` heading (falling back to the branch name) and a body summarizing the spec path and task completion count from `tasks.md`
7. Runs `gh pr create` against the configured base branch (or the repository's default branch)

## Execution

Determine the event name from the hook that triggered this command (default to `after_implement` if invoked manually), then run the script:

- **Bash**: `.specify/extensions/git/scripts/bash/create-pr.sh <event_name>`
- **PowerShell**: `.specify/extensions/git/scripts/powershell/create-pr.ps1 <event_name>`

## Configuration

In `.specify/extensions/git/git-config.yml`:

```yaml
auto_pr:
  draft: false    # Open the PR as a draft
  base: ""        # Target branch; blank = repository default branch
  title: ""       # PR title; blank = derived from spec.md heading / branch name
```

## Graceful Degradation

- If Git, `gh`, or an authenticated `gh` session is missing: skips with a warning and a pointer to https://cli.github.com/
- If no `origin` remote is configured: skips with a warning
- If a pull request already exists for the branch: skips and prints the existing PR URL
- If the current branch is the same as the base branch: skips with a warning
