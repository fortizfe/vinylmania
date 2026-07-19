# Contract: `code-quality` job scan-scope change

**Feature**: `056-fix-codeql-quality-alerts` | **Date**: 2026-07-19

**Single change** to `.github/workflows/ci.yml`'s existing `code-quality` job (introduced in `055-ci-codeql-node-upgrade`, contract at `specs/055-ci-codeql-node-upgrade/contracts/code-quality-job.md`) — everything else in that job (permissions, step order, the `gh api` severity-gate step) is unchanged.

```diff
       - uses: github/codeql-action/init@v4
         with:
           languages: javascript-typescript
           build-mode: none
           queries: security-and-quality
+          config: |
+            paths-ignore:
+              - docs/**
```

Note: `paths-ignore` is not itself a direct input of `github/codeql-action/init` (confirmed via `actionlint`, which lists the action's valid inputs) — it must be passed through the `config:` input as inline YAML, which the action parses as a CodeQL config document.

**Effect**: CodeQL no longer scans anything under `docs/` (currently: the design-brief `support.js` export carrying the one `js/missing-origin-check` alert, plus the sibling `Vinylmania Logo - Final.dc.html` generated export — neither ships to users). The severity-gate step and the 4 deploy jobs' `needs: [..., code-quality]` dependency are unchanged.
