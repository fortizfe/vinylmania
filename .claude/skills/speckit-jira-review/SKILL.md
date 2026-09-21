---
name: speckit-jira-review
description: Move the feature's Jira issue to 'En revisión' (In Review) after implementation
compatibility: Requires spec-kit project structure with .specify/ directory and the atlassian MCP tools
metadata:
  author: project-local (vinylmania)
  source: jira:commands/speckit.jira.review.md
user-invocable: true
disable-model-invocation: false
---

# Jira: card → In Review

Runs as the `after_implement` hook — for `/speckit-implement` and for
`/speckit-implement-with-agents`, which dispatches the same hooks.

## Execution

1. **Find the Jira key** recorded by `speckit.jira.start`:

   ```bash
   cat "$(python3 -c 'import json;print(json.load(open(".specify/feature.json"))["feature_directory"])')/.jira" 2>/dev/null
   ```

   If the file is missing or empty, this feature did not come from Jira: output
   `[jira] No Jira key recorded for this feature; skipped` and stop.

2. **Transition the issue** with the `atlassian` MCP tools
   (`cloudId: fortizfe.atlassian.net`):
   - `getTransitionsForJiraIssue` for the key.
   - Pick the transition whose `to.id` is `10002` (status **En revisión**). If no
     such transition exists, fall back to the first one whose name matches
     `revisi` or `review`, case-insensitively.
   - If the issue is already in that status, skip the transition.
   - `transitionJiraIssue` with the chosen transition id.

3. Report one line: `[jira] VINYLMANIA-123 → En revisión` (or why it was skipped).

## Graceful Degradation

Never fail the host command. If the atlassian MCP tools are unavailable, the
issue does not exist, or the transition is not permitted, warn in one line and
exit successfully.
