# Project Rules — spreadsheet-ai

Binding rules. Adapted from `product_image_discovery_admin/docs/RULES.md`.

## Source of truth
- Canonical plan: `docs/plan.md`.
- Live progress: `docs/PROGRESS.md`. Lessons: `docs/LESSON.md`.
- Pixel/design reference: `%USERPROFILE%\Downloads\SpreadsheetAi\tabular-review-demo\project\` and `resources/Tabular-Review-Banner.png`.
- Backend pattern reference: `%USERPROFILE%\Documents\DocLore\Visual Basic\Ai\AskMyDocs`.
- Narrative/feature reference: `%USERPROFILE%\Downloads\medium\SpreadsheetAi\article-bozza-italiano.md`.

## Implementation defaults
- Laravel 13, PHP `^8.3` (local Windows runtime: Herd `php84` at `%USERPROFILE%\.config\herd\bin\php84\php.exe`). SQLite (`database/database.sqlite`). Queue `sync`.
- LLM via `laravel/ai` (`>=0.6,<0.6.8` — upper bound pinned at scaffolding time; verify no breaking changes before M2 and widen if safe). Default provider Anthropic, model `claude-haiku-4.5`. `AI_MOCK=true` by default.
- Frontend: Blade shell + Vite + React 19 + Tailwind v4 + Glide Data Grid + TanStack Query.
- API under `/api/...`. SSE stream is synchronous (no Redis/Horizon).
- Rows are real e-commerce entities (returns/orders/articles/campaigns), seeded from the 5 presets.

## Engine rules
- 17 formats live in the `FormatType` enum — the single source of truth. Adding a format = new case + `promptSuffix()` + validator entry + cell renderer.
- `json_path` is LLM-free: resolves against the serialized row JSON (`$.a.b`, `a.b`, `$['a']['b']`; booleans → "true"/"false"; missing → red refusal).
- One batched LLM call per row → one JSON line per column. Mock mode returns cooked preset cells.
- No-context refusal: a row/column with no usable context → `{flag:red, summary:null}`, never an empty 200. (Called "R14" in plan.md §1.C.)
- Persist cells with atomic DB upsert keyed `(review_id, row_id, column_index)`, then re-`first()`.
- Encode cell content with `JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE`; degrade to red on failure.

## Security rules
- Never return provider error messages, API keys, secrets, or auth headers in JSON/UI. Log full server-side; return a generic "provider error" cell.
- Controllers use `config()`, never `env()`.
- `url`-format cells: validate `http:`/`https:` before any `window.open`.
- CSV/any export: neutralize spreadsheet formula prefixes (`=`, `+`, `-`, `@`).
- Demo seeders gate to `local`/`testing` environments.

## UI rules
- Single beautiful page. Dense layout, border radius ≤ 8px, no nested cards.
- Glide canvas grid (not a DOM table). Skeleton/Loading cell while generating; top progress bar.
- Every icon-only button needs an accessible label + tooltip.
- No text overlap/overflow at desktop, narrow desktop, tablet, 125% and 150% zoom.
- Confidence dot + citation badge + flag background tint per cell; guard `NaN` before any color/width math.

## Testing rules
Run the relevant subset before each PR (M1+ only — no `composer.json` exists before M1):
```
composer validate --strict
npm run phpunit        # Herd PHP wrapper, not XAMPP
npm run test           # Vitest, pool: threads
npm run build          # Vite
npm run e2e            # Playwright (required for any UI/UX task)
```
- Pure-code tasks: PHPUnit/Vitest only. UI/UX tasks: Playwright scenarios for **every** interaction.
- Playwright: exact label selectors; clean up created rows in `finally`; don't assume globally-unique rows under parallel projects.
- Vitest CI: `LARAVEL_BYPASS_ENV_CHECK=1`; validate lockfile with `npx npm@10 ci --dry-run`.
- If a tool is blocked (sandbox/network), record the exact blocker in `docs/PROGRESS.md`; do not silently skip.

## Review rules (two-phase: local then GitHub)
Order per (sub)task: local tests green → **local Copilot review loop** → push → PR → **GitHub Copilot review** → CI+comments loop → merge.

### Phase 1 — Local Copilot review (before any push)
- Run the Copilot CLI against the **complete branch diff vs `origin/main`**, invoking the `/review` skill explicitly (give it the full diff, not just open/changed files, so it has context). See `AGENTS.md §Local Copilot review` for the exact command.
- Fix every legitimate finding, re-run local tests, re-run the local review; loop until clean. Then push.

### Phase 2 — GitHub CI + Copilot review (after push/PR) — MANDATORY, never merge early
- **CI**: `.github/workflows/ci.yml` runs on every PR (composer validate, phpunit, typecheck, vitest, vite build, Playwright e2e). It MUST be **green** before merge.
- **Copilot review**: request it via REST `gh api --method POST repos/<owner>/<repo>/pulls/<PR>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'`; confirm with `gh pr view <PR> --json reviewRequests` (lists `Copilot`). `gh pr edit --add-reviewer @copilot` is a silent no-op. Copilot can take several minutes — **wait for the review to actually post** (`gh pr view <PR> --json reviews` shows a Copilot review) and ensure **zero unresolved inline comments** (`gh api .../pulls/<PR>/comments`).
- **Merge ONLY when CI is green AND Copilot has reviewed with zero open comments.** If CI red or Copilot has comments → fix, push, re-request review, loop. NEVER merge while CI is pending/red or Copilot hasn't reviewed. (The earlier "bounded-wait, merge anyway" policy is REVOKED.)
- Do not use `@codex review` unless the user explicitly asks.
- Fold Copilot learnings (local + GitHub) into `docs/LESSON.md`.

## Documentation rules
- Update `docs/PROGRESS.md` after meaningful work; `docs/LESSON.md` on non-obvious findings. Date entries `YYYY-MM-DD`.

## Hard-won engineering rules (distilled from `docs/LESSON.md`, M1–M6)
Apply these proactively to avoid repeating fixed mistakes:
- **CI runs phpunit before `npm run build`** → any feature test that renders a `@vite()` Blade view must call `$this->withoutVite()`. Don't depend on built assets in PHP tests.
- **Windows-generated `package-lock.json` omits Linux optional native deps** (Vite 8/rolldown) → CI uses `npm install`, not `npm ci`.
- **`overflow-x: clip`** for no-overflow containers; never add an `overflow-x: hidden` fallback on a measured container (it forces `overflow-y: auto` → scrollbar → false overflow). Glide/grid flex wrappers need **`min-width: 0`** so the canvas sizes to the container, not its intrinsic column width.
- **React Query structural sharing** can keep the same array reference after an optimistic update → effects keyed on that array may never fire. Trigger side-effects (e.g. regenerate) **directly in mutation `onSuccess`**, not via an effect watching the query data.
- **Timers/EventSource**: store ids in a ref and clear on close/unmount/selection-change. Reset transient UI state (`copied`, `open`) when the selected entity changes.
- **Drawers/dialogs**: close only on mutation success (keep input on error + toast); Escape handler + initial focus; client-side validation mirroring the backend FormRequest (avoid 422 round-trips).
- **Types at the boundary**: cell `summary` is `unknown` (backend persists non-string JSON) — render via `valueToText`/`cellDisplayText`, never as a bare string. One shared pure function for grid + export (no duplicated display logic).
- **Local `copilot --yolo`** edits + commits + `git add -A` (can sweep temp files) — gitignore `.review-diff.patch`; pass the diff via a file, not inline `$(git diff)`.
- **GitHub Copilot review** is slow (minutes) and re-reviews on every push; resolve threads via GraphQL `resolveReviewThread`; merge only at CI-green + 0 unresolved, stable for several polls.

## Agent model rules
- Sub-agents get disjoint write scopes. Hand each `docs/LESSON.md` + `docs/plan.md` + `docs/RULES.md` + `AGENTS.md`.
- Main agent stays integrator + final reviewer + merger.
