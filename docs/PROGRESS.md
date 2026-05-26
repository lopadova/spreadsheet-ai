# PROGRESS.md — spreadsheet-ai

Live "where am I" log. Newest first. Resume from the top after any interruption.

## 2026-05-26

### Done
- Analyzed all sources: article (`article-bozza-italiano.md`), design prototype (`tabular-review-demo/project/*`), AskMyDocs backend (`FormatType`, `TabularReviewExtractor`, `AiManager`, `laravel/ai` usage), and the governance template repo `product_image_discovery_admin`.
- Confirmed 3 architecture decisions with the user: **SQLite**, **synchronous SSE (no Redis)**, **Mock default + Live toggle**.
- Wrote `docs/plan.md` (deep analysis §1 + 8 macro tasks M0–M7 with sub-tasks, objectives, guardrails).
- **M0 governance scaffolding created**: `AGENTS.md`, `CLAUDE.md`, `docs/RULES.md`, `docs/LESSON.md`, `docs/PROGRESS.md`, and the resume skill `.claude/skills/spreadsheet-ai-plan/SKILL.md`.
- Catalogued screenshot assets in `resources/`: `Tabular-Review-Banner.png`, `Tabular-Review-Ai-suggested.png`, `Tabular-Review-Prompt-Column.png` (for the WOW README in M7.2).
- User added requirement: final README must be a WOW community README (badges, banner, TOC, idea/intuition, innovation, MikeOSS credit, screenshots, junior-proof quickstart). Captured in plan M7.2.

### Repo state
- Only `LICENSE`, `README.md` (stub), plus the new `docs/`, `AGENTS.md`, `CLAUDE.md`, `.claude/` governance files. No Laravel app / frontend yet.

### M1 outcome (2026-05-26) — MERGED (PR #2)
- Laravel 13.8 + `laravel/ai 0.6.7` (anthropic provider). 9 migrations (ecommerce + tabular), models/factories, `PresetData` (ported from data.jsx), seeders, `config/ai.php`+`config/tabular.php`. React 19 + Vite 8 + Tailwind v4 shell, design tokens, Vitest+Playwright tooling, `scripts/run-php.mjs`.
- Gates green: composer validate, migrate+seed, **phpunit 25/198**, typecheck, vitest, build, e2e. Built by 2 parallel sub-agents (disjoint scopes), integrated + local-Copilot-reviewed by integrator.
- GitHub Copilot review again not serviced → merged under bounded-wait policy.

### M2 local Copilot review outcome (2026-05-26)
- Full diff `.review-diff.patch` reviewed. 6 issues found and fixed:
  1. `JsonPathResolver::stringifyValue` — removed dead `=== false` branch (unreachable after `JSON_THROW_ON_ERROR`).
  2. `TabularReviewExtractor::persistCell` fallback — added `JSON_THROW_ON_ERROR` to the degraded `json_encode` call for consistency.
  3. `ColumnRequest` — added `'min:1'` to `enum_values` rule; prevents a silent empty-array enum column.
  4. `StreamController` catch block — was emitting ONE red cell (`$columnIndexes[0] ?? 0`) instead of one per affected column; fixed to fan out over all column indexes.
  5. `StreamController::emit()` — guard `json_encode` returning `false` (skip event rather than emit `data: false`).
  6. `StreamController` catch — added `Log::warning` so unexpected row-level throws are visible in the log.
  7. `TabularReviewExtractor::extractReview` — documented the `$force` parameter as reserved/no-op.
- All 162 tests green after fixes.

### M2 outcome (2026-05-26) — MERGED (PR #3)
- Backend engine: 17-format enum, JsonPathResolver, RowContextBuilder, FlagClassifier, TabularAiClient (laravel/ai `agent()->prompt()`), TabularReviewExtractor (Mock+Live, R14, atomic upsert), ReviewHydrator, REST API, synchronous SSE. **62 phpunit / 336 assertions.** Live API smoke OK. Local Copilot review applied; nested .gitignore restored + generated artifacts untracked. GitHub Copilot posted a transient/empty review.
- **API contract**: `GET /api/reviews/{preset}` → `{review:{id,preset_key,title,row_source}, base_columns:[{id,name}], columns:[{index,name,prompt,format,enum_values?,json_path?}], rows:[{row_id,...displayFields}], cells:[{row_id,column_index,content,flag,confidence,status}], suggestions_available}`. `GET /api/suggest/{preset}` → `{preset, suggestions:[{name,format,prompt,enum_values?}]}`. Column CRUD: POST/PATCH/DELETE `/api/reviews/{id}/columns[/{index}]`. SSE: `GET /api/reviews/{id}/stream?cols=&force=`.
- **TODO (M4)**: `base_columns` only returns `{id,name}` — width/align/mono lost vs prototype. Enrich the API (small backend tweak) or default widths client-side in M4.

### M3 outcome (2026-05-26) — MERGED (PR #4)
- React 19 page shell: CSRF API client, TanStack Query hooks (useReview seeds cell store), cell store keyed row:col, components TopChrome/Hero/PresetChips/ActionBar/StatusFooter/GridPlaceholder/Toast/TabularPage. Vitest 30, e2e 3/3, typecheck+build clean. Local Copilot review applied. base_columns lacks width (M4 assigns).

### M4 outcome (2026-05-26) — MERGED (PR #5)
- Glide canvas grid + 17 renderers + live SSE (single EventSource, run-token guard, atomic updateCells, skeleton+progress) + a11y mirror table. Vitest 63, e2e 6/6, visual matches banner. Local Copilot review applied. SSE blocks single artisan-serve worker → Playwright workers:1.

### M5 outcome (2026-05-26) — MERGED (PR #6) via FULL strict loop
- Column editor (17-format picker, auto-generate, json_path, cost card, validation), AI Suggest picker, citation side-panel, bulk regenerate. Vitest 93, e2e 12/12.
- **Strict CI+Copilot loop validated**: CI green (after fixing Vite-manifest + npm-lockfile CI issues) AND GitHub Copilot reviewed across **6 rounds** (8→2→2→2→1→2 findings, all real & fixed: regen structural-sharing bug, editor close-on-success, validation, timer cleanup, gridSelection clearing on preset-switch/delete, test hygiene). All threads resolved before merge.
- User-review fixes of PR #1–#5 also landed here (workflows UNIQUE, functional `force`, TopChrome buttons, client ReviewResponse typing, doc fixes).

### M6 outcome — MERGED (PR #7)
- CSV export (formula-neutralized) + polish (a11y, no-overflow at 125/150% zoom). Vitest 112, e2e 17/17. Strict loop: CI green (after fixing a Linux-only grid flex `min-width:0` overflow) + **6 Copilot rounds** all resolved.

### M7 — release (in progress)
- CI already live (added M5). WOW community README written (badges, banner, screenshots, MikeOSS credit, junior quickstart). LESSON distilled into `docs/RULES.md` hard-won rules. License resolved: kept Apache-2.0, README accurate. Next: tag `v0.1.0` + GitHub release.

### BUILD STATUS: M0–M6 all merged to `main`; M7 finalizing.

### Next

- **M7 — tag `v0.1.0` + GitHub release** (in progress): WOW README merged; RULES.md distilled. Remaining: cut the tag, publish the GitHub release, fold LESSON back into AGENTS.md/CLAUDE.md/skills.

### Blockers
- **GitHub Copilot PR review — RESOLVED understanding**: initially looked "not serviced" (PR #1: request cleared instantly), but from PR #3 onward it posts real inline reviews — just **slow/intermittent** (minutes). The bounded-wait "merge anyway" policy was **REVOKED**; binding gate is now CI green + Copilot reviewed with zero unresolved comments (see `docs/LESSON.md` + `docs/RULES.md`). Validated across M5–M7.
- ~~License mismatch: repo is Apache-2.0, README/article say MIT → resolve in M7.~~ **RESOLVED (M7):** README badges + License section now state Apache-2.0 accurately.

### M0 outcome (2026-05-26)
- PR #1 `task/m0-governance` → `main`: local Copilot `/review` passed (13 fixes), local gates N/A (docs only), GitHub Copilot review unavailable → merged under the bounded-wait policy.
