---
name: speckit-git-commit
description: Commit the changes of the Spec Kit phase that just finished, using the conventional-commit message configured for that hook event
argument-hint: "Optional hook event name, e.g. after_plan"
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: project-local (vinylmania)
  source: git:commands/speckit.git.commit.md
user-invocable: true
disable-model-invocation: false
---

# Auto-Commit Changes

Stage and commit the working tree for the Spec Kit phase that triggered this hook.

## Execution

1. Determine the event name:
   - Use `$ARGUMENTS` if it names an event (`after_specify`, `after_plan`,
     `after_tasks`, `after_implement`, `after_clarify`, `after_checklist`,
     `after_analyze`, `after_taskstoissues`, `after_constitution`, or the
     `before_*` equivalents).
   - Otherwise derive it from the hook that invoked you: the phase that just ran
     (or is about to run) plus the `after_`/`before_` prefix.

2. Run the script from the repository root:

   ```bash
   .specify/extensions/git/scripts/bash/auto-commit.sh <event_name>
   ```

   The script reads `.specify/extensions/git/git-config.yml`, and exits quietly
   when the event is disabled or there is nothing to commit. It builds the
   message from that config — do **not** compose your own message or run
   `git commit` yourself, so every phase commit stays in the configured
   Conventional Commits format (`{scope}` = feature number, `{name}` = feature
   slug, both resolved from `.specify/feature.json`).

3. Report the script's single output line to the user.

## Graceful Degradation

Never fail the host command: if git is missing, this is not a repository, or the
commit is rejected, relay the warning and continue.
