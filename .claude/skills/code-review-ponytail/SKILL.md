---
name: code-review-ponytail
description: Vinylmania code review = ponytail over-engineering review + ponytail debt check + correctness pass against the constitution (Test-First, hexagonal dependency rule, backend-only network, WCAG/UI gates, one class per file, Flutter architecture). Use to review the local diff, a branch or a PR ("revisa este PR", "review my changes", "code review con ponytail"). Reports in the terminal by default; posts a single GitHub review only when asked or when run by reviewer-agent. Read-only on code.
argument-hint: "[PR number | URL | branch] [--post]"
---

# Code review with ponytail — Vinylmania

Three passes, always all three, then one report. Never edit code here; fixes go
to `backend-agent` / `frontend-agent` / `qa-agent` if the user asks.

## 0. Resolve the target

- PR number/URL → `gh pr view <arg> --json number,title,body,headRefName,headRefOid,baseRefName,url,files` and `gh pr diff <n>`.
- Branch → `git diff main...<branch>`.
- Nothing → current branch's PR if one exists, else `git diff main...HEAD` plus uncommitted changes (`git diff HEAD`).

Read the changed files in full where the hunk alone doesn't tell you what the
code does. Read `specs/<NNN>/` if the change implements one.

## 1. Ponytail review (over-engineering)

Invoke the `ponytail:ponytail-review` skill over the diff and keep its format:
`<file>:L<line>: <delete|stdlib|native|yagni|shrink>: <what>. <replacement>.`
ending in `net: -<N> lines possible.` or `Lean already. Ship.`

Project-specific things to look for:
- A new helper/component/hook that duplicates one already in the repo
  (`frontend/src/components/ui/`, `motion/`, `hooks/`; `backend/src/shared/`,
  `adapters/cache/cacheAside.ts`, `adapters/discogs/respond*Error.ts`). Name the existing file.
- Ports with one method used once, factories for one product, config for a
  constant, empty `.gitkeep` scaffolding, wrapper components that only forward props.
- New dependencies in `package.json` for what a few lines or the platform do.

## 2. Ponytail debt

Invoke `ponytail:ponytail-debt` scoped to the added lines
(`gh pr diff <n> | grep -E '^\+.*ponytail:'`, or the same on `git diff`).
Every new `ponytail:` marker must name its ceiling and upgrade path. Flag the
ones that don't, and changes that hit an existing recorded ceiling without paying it.

## 3. Correctness pass (ponytail skips bugs — you don't)

Only report what has a concrete failure scenario. Check, most severe first:
- **Bugs**: logic errors, unhandled promise rejections, wrong status codes, races, data loss in write-through flows (Discogs first, then the Firestore mirror).
- **Security at trust boundaries**: missing `requireAuth`, missing `zod` validation, uid taken from the body instead of the session, internal error details leaked in responses.
- **§I Test-First**: behavior change without a test that would fail without it; tests that only assert the implementation. Compare commit order when it matters (`git log --oneline main..HEAD -- <test> <src>`).
- **§VIII Hexagonal**: `domain/`/`application/` importing SDKs or `adapters/`; business logic in routes. Use the check in the `hexagonal-architecture` skill.
- **§II Discogs**: calls bypassing the shared rate limiter/retry/cache; catalog data persisted as source of truth.
- **§IX**: frontend calling anything but our backend via `services/apiClient.ts`; `flutter_app/` calling anything but our backend through `ApiClient`.
- **§XII One class per file**: any touched file declaring a second class (TS/Dart) or exporting a second React component; a touched legacy multi-class file that was extended instead of split. Allowed: a `StatefulWidget` + its private `State`; sealed subclasses in their own `part` files.
- **Flutter diffs**: load `flutter-architecture` and `flutter-design` and run their dependency-rule and one-class checks; widgets with logic, ViewModels calling services, `Platform.isX` in widgets, hex/Duration/Curve literals outside `ui/core/theme/`, missing compact or expanded layout, missing `meetsGuideline` assertions.
- **§X/§XI + Tailwind gates** (frontend diffs): use the checklist in the `frontend-design` skill — touch targets, focus ring, skeletons, layout shift, dark mode, dual layout, motion tokens, reduced motion.
- **Commits**: conventional-commit type matches the change (`feat`/`fix` trigger releases).

## Report

```
## 🐴 Ponytail review
<findings or "Lean already. Ship.">
net: -N lines possible.

## 🧾 Ponytail debt
<new/unpaid ponytail: markers or "No new debt.">

## 🐛 Correctness
<findings, most severe first, `file:line — problem — failure scenario`, or "Nothing found.">

**Verdict:** ✅ Ship | ⚠️ Ship after fixes | ⛔ Blocker
```

No praise section, no lint-level nits, no "consider maybe". One line per
finding, location first. Write in the language of the PR description (default:
the user's language).

## Posting to GitHub (only with `--post`, or when reviewer-agent runs this)

One review per run, event `COMMENT` (author and reviewer are usually the same
account, so APPROVE/REQUEST_CHANGES fail). Build the payload in the scratchpad:

```bash
gh api repos/{owner}/{repo}/pulls/<n>/reviews --method POST --input review.json
```

```json
{ "commit_id": "<headRefOid>", "event": "COMMENT", "body": "<report>",
  "comments": [{ "path": "backend/src/x.ts", "line": 42, "side": "RIGHT", "body": "<finding>" }] }
```

Inline comments only on lines inside the diff; anything else goes in the body.
Before posting, read existing reviews (`gh api repos/{owner}/{repo}/pulls/<n>/reviews`)
and reference still-open findings instead of repeating them.
