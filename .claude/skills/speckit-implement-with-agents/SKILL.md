---
name: "speckit-implement-with-agents"
description: "Run /speckit-agent-assign-execute to completion and then run the same after_implement extension hooks /speckit-implement runs (git commit/PR, Companion journaling) — a project-local wrapper that composes the two without modifying either."
argument-hint: "Optional implementation guidance or task filter (forwarded as-is to speckit-agent-assign-execute)"
compatibility: "Requires spec-kit project structure with .specify/ directory, plus the agent-assign extension (speckit-agent-assign-assign / speckit-agent-assign-validate / speckit-agent-assign-execute) installed"
metadata:
  author: "project-local (vinylmania)"
  source: "custom wrapper — composes speckit.agent-assign.execute with speckit.implement's after_implement hooks"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). Forward it as-is to `/speckit-agent-assign-execute` in step 2 below — do not alter or reinterpret it.

## Why this command exists

This is a **project-local** command. It is not part of any spec-kit core template
and not part of the `agent-assign` extension — it lives only in this repository's
`.claude/skills/`, so no future update to spec-kit or to the `agent-assign`
extension can silently overwrite or drop it.

`/speckit-agent-assign-execute` correctly executes `tasks.md` dispatching each
task to its assigned specialized agent (or running it directly for tasks
assigned `default`), but — unlike `/speckit-implement` — it does not check
`.specify/extensions.yml` for `before_implement`/`after_implement` hooks. That
means using it on its own silently skips whatever other installed extensions
expect to run around implementation — in this project, concretely: `git`'s
auto-commit/PR offer, and Companion's `speckit.companion.after-implement`
journaling (the hook that marks the spec's `status` as `implemented` in
`.spec-context.json` once every task is checked off).

This command does not change how either of those commands behaves. It simply
calls `/speckit-agent-assign-execute` unmodified, and then — itself — performs
the exact same `after_implement` hook dispatch that `/speckit-implement`
performs when it finishes. Prefer this command over calling
`/speckit-agent-assign-execute` directly whenever you want agent-based
execution *and* want the rest of the toolchain (Companion, git) kept in sync,
exactly as if you had run `/speckit-implement`.

## Outline

1. **Prerequisites check**: Confirm the `agent-assign` extension is installed
   (`/speckit-agent-assign-assign`, `/speckit-agent-assign-validate`, and
   `/speckit-agent-assign-execute` must all be available as commands/skills).
   If it is not installed, **STOP** and tell the user this command requires the
   `agent-assign` extension, and that they can use `/speckit-implement` directly
   instead.

2. **Delegate task execution to `/speckit-agent-assign-execute`**: Invoke that
   command now, forwarding `$ARGUMENTS` unchanged, and run it exactly as it is
   defined (its own prerequisite checks, its own `agent-assignments.yml`
   lookup, its own phase-by-phase execution with per-task agent dispatch, its
   own progress tracking and error handling). Wait for it to fully finish
   before continuing.

   - If `/speckit-agent-assign-execute` stops early on its own (for example,
     because `agent-assignments.yml` is missing, or because it halts a phase
     on a non-parallel task failure), **STOP here too** and relay its message
     to the user as-is. Do **not** proceed to step 3 — no implementation work
     actually completed, so the `after_implement` hooks below must not fire.
   - If it completes (all tasks executed, whether all succeeded or some
     parallel failures were reported at phase end per its own rules), proceed
     to step 3.

3. **Mandatory Post-Execution Hooks** — run only after step 2 completes; this
   reuses the exact same `after_implement` key and dispatch rules that
   `/speckit-implement` uses, so installed extensions cannot tell the
   difference between this command and `/speckit-implement` having run:

   **You MUST complete this section before reporting completion to the user.**

   Check if `.specify/extensions.yml` exists in the project root.
   - If it does not exist, or no hooks are registered under `hooks.after_implement`, skip to the Completion Report.
   - If it exists, read it and look for entries under the `hooks.after_implement` key.
   - If the YAML cannot be parsed or is invalid, skip hook checking silently and continue to the Completion Report.
   - Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
   - For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
     - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
     - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
   - When constructing slash commands from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `/speckit-git-commit`.
   - For each executable hook, output the following based on its `optional` flag:
     - **Mandatory hook** (`optional: false`) — **You MUST emit `EXECUTE_COMMAND:` for each mandatory hook**:
       ```
       ## Extension Hooks

       **Automatic Hook**: {extension}
       Executing: `/{command}`
       EXECUTE_COMMAND: {command}
       ```
       After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
     - **Optional hook** (`optional: true`):
       ```
       ## Extension Hooks

       **Optional Hook**: {extension}
       Command: `/{command}`
       Description: {description}

       Prompt: {prompt}
       To execute: `/{command}`
       ```

4. **Completion Report**: Report final status combining (a) the Execution
   Summary already produced by `/speckit-agent-assign-execute` in step 2
   (per-phase table, agents used) and (b) which `after_implement` hooks ran or
   were skipped in step 3.

## Done When

- [ ] `/speckit-agent-assign-execute` ran to completion (or this command
      stopped early and relayed why, without running step 3)
- [ ] `after_implement` hooks dispatched or skipped per the rules in step 3
- [ ] Completion reported to user with a combined summary
