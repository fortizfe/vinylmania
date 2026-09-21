---
description: "Move the feature's Jira issue to 'En curso' (In Progress) and record its key in the spec directory"
---

# Jira: card → In Progress

Runs as the `after_specify` hook. Only does something when `/speckit-specify` was
invoked with a Jira key or URL — otherwise it exits silently.

## Execution

1. **Find the Jira key.** Look at the argument the user passed to
   `/speckit-specify` in this session. Accept either form:
   - a key: `VINYLMANIA-123`
   - a URL: `https://fortizfe.atlassian.net/browse/VINYLMANIA-123`

   If the argument contains no `VINYLMANIA-\d+`, output
   `[jira] No Jira key in the specify arguments; skipped` and stop. Do **not**
   ask the user for one.

2. **Record the key** so `speckit.jira.review` can find it later. Read
   `feature_directory` from `.specify/feature.json` and write the bare key:

   ```bash
   printf '%s\n' "VINYLMANIA-123" > "$(python3 -c 'import json;print(json.load(open(".specify/feature.json"))["feature_directory"])')/.jira"
   ```

3. **Transition the issue** with the `atlassian` MCP tools
   (`cloudId: fortizfe.atlassian.net`):
   - `getTransitionsForJiraIssue` for the key.
   - Pick the transition whose `to.id` is `10001` (status **En curso**). If no
     such transition exists, fall back to the first one whose name matches
     `en curso` or `in progress`, case-insensitively.
   - If the issue is already in that status, skip the transition.
   - `transitionJiraIssue` with the chosen transition id.

4. Report one line: `[jira] VINYLMANIA-123 → En curso` (or why it was skipped).

## Graceful Degradation

Never fail the host command. If the atlassian MCP tools are unavailable, the
issue does not exist, or the transition is not permitted, warn in one line and
exit successfully.
