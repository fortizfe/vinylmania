# Contrato: job `code-quality` en `.github/workflows/ci.yml`

**Feature**: `055-ci-codeql-node-upgrade` | **Date**: 2026-07-19

Esta feature no expone una API HTTP; su "interfaz" es el contrato del job de GitHub Actions (qué
inputs consume, qué outputs/efectos produce, y qué contrato usan a su vez los 4 deploy jobs que
pasan a depender de él). Se documenta aquí para que `/speckit-tasks` pueda derivar tareas concretas
sin reinterpretar `research.md`.

## Job `code-quality`

**Trigger**: idéntico al de `backend-test`/`frontend-test`/`e2e-test` — `pull_request` y `push` a
`main` (implícito en el `on:` global de `ci.yml`, sin condición `if` propia).

**Permissions**:
```yaml
permissions:
  security-events: write
  contents: read
  actions: read
```

**Steps (orden fijo)**:

1. `actions/checkout@v5`
2. `github/codeql-action/init@v4`
   ```yaml
   with:
     languages: javascript-typescript
     build-mode: none
     queries: security-and-quality
   ```
3. `github/codeql-action/analyze@v4`
   ```yaml
   with:
     category: "/language:javascript-typescript"
   ```
   (`wait-for-processing` no se fija explícitamente — su default `true` es lo que garantiza que el
   step siguiente pueda consultar alertas ya procesadas, ver research.md §4)
4. Step de verificación de severidad (nombre sugerido: "Fail on Critical/High CodeQL alerts"):
   - Usa `gh api` (preinstalado en `ubuntu-latest`) con `GH_TOKEN: ${{ github.token }}`.
   - Consulta: `gh api "repos/${{ github.repository }}/code-scanning/alerts?ref=${{ github.ref }}&state=open" --paginate`
   - Filtra (`jq`) por `.[] | select(.rule.security_severity_level == "critical" or .rule.security_severity_level == "high")`.
   - Si el filtro devuelve al menos un resultado: imprime cada alerta (`rule.description`,
     `html_url`) y termina el step con `exit 1`.
   - Si no hay resultados: el step termina en éxito (`exit 0`), sin bloquear alertas Medium/Low ni
     alertas de calidad sin `security_severity_level` (FR-003).

**Outputs / efectos observables**:
- Alertas CodeQL visibles en la pestaña Security → Code scanning del repositorio (persistidas por
  GitHub, no por esta feature).
- El resultado del job (`success` / `failure` / `skipped`) visible en el resumen del run, igual que
  los jobs de test (FR-002).
- Ante `failure` del step 4, los 4 deploy jobs quedan automáticamente en `skipped` por su nueva
  dependencia `needs` (ver `deploy-jobs.md`, sección siguiente).

## Deploy jobs (`deploy-production-*`, `deploy-preview-*`) — contrato modificado

**Único cambio respecto al contrato ya documentado en
`specs/054-gate-deploys-on-passing-tests/contracts/deploy-jobs.md`**:

```diff
- needs: [backend-test, frontend-test, e2e-test]
+ needs: [backend-test, frontend-test, e2e-test, code-quality]
```

El resto del contrato de esos 4 jobs (evento, condición `if`, steps de Vercel CLI,
`concurrency.group` en los de producción) permanece exactamente igual — no se documenta de nuevo
aquí para no duplicar `054`.

## Contrato de versiones de acciones (FR-006, FR-007) en jobs existentes

**`e2e-test`** — únicos cambios (steps ya existentes, solo se actualiza `uses:`):
```diff
- uses: actions/cache@v4
+ uses: actions/cache@v6
```
(aplicado a los dos usos: caché de binarios del emulador Firebase y caché de navegadores Playwright)
```diff
- uses: actions/setup-java@v4
+ uses: actions/setup-java@v5
```
```diff
- uses: actions/upload-artifact@v4
+ uses: actions/upload-artifact@v6
```

**`deploy-preview-backend` / `deploy-preview-frontend`** — step "Comment preview URL on PR":
```diff
- uses: actions/github-script@v7
+ uses: actions/github-script@v8
```

**`backend-test`, `frontend-test`, `release`, `deploy-production-backend`,
`deploy-production-frontend`, `deploy-preview-backend`, `deploy-preview-frontend`** — input de
`actions/setup-node@v5` (la versión de la acción no cambia, solo el input):
```diff
  uses: actions/setup-node@v5
  with:
-   node-version: 20
+   node-version: 24
```

`e2e-test` ya usa `node-version: 24` — sin cambios ahí. `actions/checkout@v5` y
`reviewdog/action-actionlint@v1` no requieren cambios (research.md §7).
