---
name: user-story
description: Read, refine or create Vinylmania user stories (HUs) — fetch a VINYLMANIA-XXX ticket from Jira with the atlassian MCP, write/refine it as .hu/<feature>.md with BDD Given-When-Then criteria, WCAG and dual-layout scenarios and an explicit Out of Scope, and optionally sync it back to Jira (summary prefix, story points, canonical labels). Use when the user gives a VINYLMANIA-XXX key or Jira URL, asks for an HU / historia de usuario / refinement, or wants a story pushed to Jira.
argument-hint: "[VINYLMANIA-XXX | feature idea]"
---

# User stories (HU) — Vinylmania

The rules live in `.agents/rules/user-stories.md` (template in §4, Jira sync
protocol in §5). Read it every time; this skill is the procedure, not a copy.
HUs are written in Spanish. `.hu/` is gitignored — HUs are local working docs,
traceability goes through Jira.

## Read a ticket

Only when the user gives an explicit `VINYLMANIA-XXX` key or a
`fortizfe.atlassian.net` URL — never search Jira on your own initiative.

1. Load the tools: `ToolSearch` `select:mcp__atlassian__getJiraIssue,mcp__atlassian__searchJiraIssuesUsingJql,mcp__atlassian__getAccessibleAtlassianResources`.
2. `getJiraIssue` → summary, description, acceptance criteria, relevant comments, linked issues. Don't ask the user to paste it.
3. Check `.hu/` and `specs/` for an existing doc on the same feature before writing a new one.

## Refine into `.hu/<kebab-feature>.md`

Follow the template in `user-stories.md` §4. Non-negotiables:
- Every acceptance criterion is Given-When-Then and testable before code (§I).
- Each story covers: happy path; edges (empty, partial Discogs data, network/rate-limit with accessible retry); a11y (keyboard, screen reader announcement, reduced motion); dual layout (mobile < 640px with 44×44 targets, desktop ≥ 1024px).
- State which clients the story targets: web, native app (`flutter_app/`: compact < 840 / expanded ≥ 840; Android, iOS, macOS, Windows, Linux), or both. Native-only behaviors (deep links, back gesture, keyboard shortcuts on desktop) get their own scenarios.
- **Fuera de alcance** section is mandatory — this is where ponytail cuts go: every speculative requirement moves there with one line on when it would earn its place.
- No requirement that makes the frontend call Discogs/Firebase/RSS directly (§IX) or stores catalog data in Firestore (§II).
- UX proposals: use `frontend-design` (and through it `apple-design`) — reference existing primitives/patterns before proposing new ones.
- End with the handoff section for `architect-agent`.

Ask only questions whose answer changes scope; default the rest and write the
default under "Supuestos y Decisiones".

## Sync to Jira (only when asked)

Follow `user-stories.md` §5: project `VINYLMANIA`; `Epic` for the HU, `Story`
per sub-story; summary `[Área] [VINYLMANIA] …`; Markdown description with BDD
criteria and the `.hu/` path; then set story points (`customfield_10016`,
Fibonacci) and canonical labels (`vinylmania` always, plus `ux-redesign`,
`wcag-aa`, `bdd`, `frontend`, `backend` as they apply). Never transition
tickets unless the user asks. Confirm with the user before creating issues.

After the first atlassian call of the session, relay the MCP server's notice
about the deprecated V1 endpoint to the user.
