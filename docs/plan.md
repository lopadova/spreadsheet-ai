# Spreadsheet-AI — Tabular Review Demo · Implementation Plan

> Canonical, cross-session plan. If a session is interrupted, read this file +
> `docs/PROGRESS.md` + `docs/LESSON.md` + `AGENTS.md` before doing anything.
>
> Last updated: 2026-05-26

---

## 0. What we are building

A **functioning, beautiful single-page demo** of an *agentic spreadsheet*
("Tabular Review" / "SpreadsheetAI"): rows are e-commerce entities, **each
column is an LLM prompt**, each cell is an AI-generated value with a confidence
flag + citation. Click a column → edit its prompt/format → regenerate. Preset
chips launch cooked scenarios. An "✨ AI Suggest" button proposes columns.
Cells stream in live (skeleton → value) cell-by-cell.

Inspiration & sources (read these, do not re-derive):
- Article (the narrative + the 7 laws + 17 formats): `%USERPROFILE%\Downloads\medium\SpreadsheetAi\article-bozza-italiano.md`
- Design prototype (pixel reference, presets, renderers, CSS tokens): `%USERPROFILE%\Downloads\SpreadsheetAi\tabular-review-demo\project\`
- Real production patterns to copy (backend): `%USERPROFILE%\Documents\DocLore\Visual Basic\Ai\AskMyDocs` (`app/Support/TabularReview/FormatType.php`, `app/Services/TabularReview/TabularReviewExtractor.php`, `app/Ai/AiManager.php`).
- Governance scaffolding template: `%USERPROFILE%\Documents\DocLore\Visual Basic\Ai\product_image_discovery_admin` (`AGENTS.md`, `docs/RULES.md`, `docs/LESSON.md`, `docs/PROGRESS.md`, `skills/`, `.github/workflows/ci.yml`).

### Confirmed architecture decisions (locked 2026-05-26)
1. **DB = SQLite** (`database/database.sqlite`). Rows are e-commerce entities from seeders; no embeddings / pgvector needed (LLM context is the DB row itself, not RAG chunks).
2. **Streaming = synchronous SSE, no Redis/Horizon.** The SSE endpoint iterates rows, calls the extractor, and echoes `cell` events as they land. Zero extra infra.
3. **LLM = Mock mode by default + a Live toggle.** Mock returns the cooked preset cells (zero cost, works offline). Live calls real `laravel/ai` (Anthropic `claude-haiku-4.5` default, provider configurable). Demo runs out-of-the-box with no API key.

### Stack
- Backend: **Laravel 13**, PHP `^8.3`, SQLite, `laravel/ai` (`>=0.6,<0.6.8`), queue `sync`.
- Frontend: **React 19 + Vite (latest) + Tailwind v4** + **@glideapps/glide-data-grid** (canvas) + **TanStack Query**. Served via a Blade shell + Vite (same pattern as the reference admin repo).
- Tests: **PHPUnit** (backend), **Vitest** (frontend units), **Playwright** (UI/UX scenarios — mandatory for every interactive feature).
- Design tokens: Geist Sans / Geist Mono, dark default, violet accent, oklch status palette (lifted from `project/styles.css`).

### Out of scope for the demo (note, do NOT build)
Multi-tenant RBAC, Spatie permissions, real RAG/pgvector ingestion, Redis/Horizon, real citation-to-source-doc viewer, human-verified lock + audit log, XLSX export (stub it), workflow sharing. We keep a single light `tenant_id='demo'` string column on tabular tables only for fidelity, with no auth.

---

## 1. Deep analysis — bugs, risks, gaps, improvements found in the sources

Findings from auditing the prototype (`project/*.jsx`), the article, and the
AskMyDocs code. These become guardrails or backlog items in the tasks below.

### A. Prototype bugs / weaknesses to FIX when porting
1. **`RJsonPath` renderer is a stub** (`cells.jsx`): it ignores the detected type and always delegates to `RPercentage`. Real impl must auto-detect (number/money/date/text) and render accordingly with a `$` sigil. → M4.
2. **Citation numbering is global & recomputed every render** (`grid.jsx` `citCounter`): O(rows×cols) each paint, and numbers reshuffle on data change. Make it stable per cell. → M4.
3. **`generateFakeValue` desyncs from real LLM shape**: AI-Suggest fake cells use `{v: ...}` while LLM path uses `{value, flag, citation}`. Normalize on one DTO. → M2/M5.
4. **No enum palette persistence**: `REnum` falls back to a hash hue; `enum_values_palette` is referenced but never populated. Decide: deterministic hash is fine for demo; document it. → M4.
5. **Percentage parsing is fragile** (`RPercentage`): mixes `+18%` / `-42%` / bare numbers; negative/positive coloring relies on string prefix. Centralize parsing + guard `NaN` (lesson from reference repo: never let `NaN` reach color logic). → M4.
6. **`resolveJsonPath` "cheats"** in the demo (returns fallback). Real json_path must resolve against the row JSON (the AskMyDocs `descend()`/`parseJsonPath()` algorithm handles `$.a.b`, `a.b`, `$['a']['b']`). → M2.
7. **No cancellation safety on preset switch mid-run**: switching preset while `running` can patch stale cells into the new preset. Guard with a run token / abort. → M4.
8. **Mock stagger uses many `setTimeout`s** — fine for prototype, but the real SSE consumer must use a single EventSource and atomic `updateCells`. → M4.
9. **DOM grid won't scale**: prototype renders all rows as divs. Article's own thesis: use canvas (Glide) for 100k rows. We adopt Glide from the start. → M4.

### B. Article claims that need a demo-appropriate simplification
10. Article uses Redis pub/sub + Horizon + KB chunks + reranker confidence. For the demo: synchronous SSE, row-as-context, and a deterministic **FlagClassifier** (green/yellow/red/grey) derived from the LLM's own flag + simple heuristics (mock supplies the flag). → M2.
11. `confidence_score` from a reranker doesn't exist here → derive a pseudo-confidence from flag (green≈0.9, yellow≈0.65, grey≈0.4, red≈0.2) so the UI tint still works. Document as demo-only. → M2.
12. Batched JSON-lines call is kept (real cost win + matches AskMyDocs). One LLM call per row, one JSON object per column line. → M2.

### C. SDK / integration facts to respect (from AskMyDocs)
13. `laravel/ai` real surface: `Laravel\Ai\AnonymousAgent`, `Laravel\Ai\Messages\{UserMessage,AssistantMessage}`, `Laravel\Ai\Gateway\TextGenerationOptions::forAgent()`, response `Laravel\Ai\Responses\AgentResponse` with `->text`, `->usage->{promptTokens,completionTokens}`, `->meta->model`, `->steps->last()?->finishReason`.
14. **`max_tokens`/`temperature` are silently dropped** unless the agent exposes `maxTokens()`/`temperature()` (AskMyDocs created `RegoloAnonymousAgent` to fix this). We must verify our agent forwards options; add a unit test asserting options reach the wire (or via the provider config). → M2 + LESSON.
15. Persist cells via an **atomic DB upsert** keyed by `(review_id, row_id, column_index)`, then re-`first()` — Eloquent `updateOrCreate` is not atomic (race under concurrency). → M2.
16. **Never surface raw provider exception messages** in API responses (may leak hostnames/keys). Log full, return a generic "provider error" cell. → M2 + security rule.
17. JSON-encode cell content with `JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE`; on failure degrade to a red cell. → M2.
18. R14 (refusal): a row/column with no usable context returns `flag:red, summary:null` — never an empty 200. → M2.

### D. Feature gaps in the prototype worth adding for a convincing demo
19. **Citation popover side-panel** (article §13): click a cell → right side-panel showing value, flag, reasoning, model, tokens, citation text, prompt used, actions (Regenerate / Copy). Demo-grade (no real source-doc viewer). → M5 (stretch; ship at least value+reasoning+citation+regenerate).
20. **Bulk regenerate**: Glide native multi-select → toolbar "Regenerate selected". → M5.
21. **Skeleton/progress**: per-cell `Loading` kind + top progress bar `done/total` (prototype has both). → M4.
22. **Export XLSX** is a stub alert in the prototype — keep a stub button (out of scope), or a trivial CSV download. Decide CSV download (cheap, real). → M6.
23. **16-format showcase preset** must render every renderer once — great Playwright assertion target. → M6.

### E. Cross-cutting guardrails (from reference repo LESSON.md)
- CSV/any export must neutralize spreadsheet formulas (`=,+,-,@`).
- Source/`url` cells: restrict to `http:`/`https:` before any `window.open`.
- Playwright on Windows: Herd PHP, exact label selectors, clean up created rows in `finally`, don't assume globally-unique rows under parallel projects.
- Vitest in CI: `pool: 'threads'`, set `LARAVEL_BYPASS_ENV_CHECK=1`, validate lockfile with `npx npm@10 ci --dry-run`.
- Controllers must not call `env()`; read `config()`.

---

## 2. Repository conventions (binding)

- **Branch per macro task**: `task/m1-foundation`, `task/m2-engine`, … Subtask work happens on short-lived branches `task/m2-extractor`, PR'd **into the macro branch**. When the macro task is done, PR the **macro branch → `main`**.
- **Definition of Done for a (sub)task** — in order, loop until green:
  1. Objective + implementation detail + guardrails defined (tests).
  2. **Local tests loop** — all green: `phpunit`, `vitest`, `vite build`, and (if UI/UX) **Playwright scenarios for every interaction**. Fix until green.
  3. **Local Copilot review loop (before any push)** — run the local Copilot CLI against the *complete* branch diff vs `origin/main`, invoking the `/review` skill, asking for regressions/bugs/bad-practices/security/improvements; fix every legitimate finding, re-run tests + review, loop until clean:
     ```bash
     copilot --autopilot --yolo -p "/review the following COMPLETE diff of the current branch against origin/main. Check thoroughly for regressions, bugs, bad practices, security issues, and possible improvements, and report concrete fixes:

     $(git diff origin/main...HEAD)"
     ```
  4. Push the branch; open PR toward the working branch.
  5. Add **GitHub Copilot** as reviewer; confirm its review actually started (GraphQL `requestReviewsByLogin` fallback with `botLogins[]='copilot-pull-request-reviewer[bot]'`, `union=true` if `gh pr edit --add-reviewer @copilot` fails on missing `read:project`).
  6. Wait for **both** CI green **and** Copilot comments.
  7. If all green → merge. Else fix broken tests + Copilot comments, push, re-request review, loop.
  8. Only when fully green: task done → next task. Record findings in `docs/LESSON.md`, progress in `docs/PROGRESS.md`.
- **Pure-code tasks** need PHPUnit/Vitest only. **Any UI/UX task** additionally needs Playwright scenarios covering all interactions.
- Update `docs/LESSON.md` whenever something non-obvious is learned (incl. from Copilot feedback). Update `docs/PROGRESS.md` after meaningful work, dated `YYYY-MM-DD`.
- Every parallel sub-agent and every new session is handed `docs/LESSON.md` + this plan + `AGENTS.md` in context.

---

## 3. Task breakdown

Legend: **[BE]** backend, **[FE]** frontend, **[T]** tests. Each subtask lists
Objective / Implementation / Guardrails (tests).

### M0 — Governance & scaffolding  ·  branch `task/m0-governance`
*(THIS task is done first, before any code — per user instruction.)*
- **M0.1** Create `AGENTS.md`, `CLAUDE.md`, `docs/RULES.md`, `docs/LESSON.md`, `docs/PROGRESS.md`, `docs/plan.md`, and a resume skill `.claude/skills/spreadsheet-ai-plan/SKILL.md`, adapting wording from `product_image_discovery_admin`.
  - Guardrails: files exist, internally consistent, cross-link each other. (No code tests.)
- **M0.2** Final-task placeholder noted: *"after all work, fold LESSON.md learnings back into rules/skills/AGENTS.md"* (see M7.3).

### M1 — Laravel foundation + DB + seed data + AI config  ·  branch `task/m1-foundation`
- **M1.1 [BE]** New Laravel 13 app in repo root (composer, `.env`, SQLite, `laravel/ai`, Sanctum optional-off, Vite). Blade shell route `/` mounting React. Health route `/up`.
  - Guardrails [T]: `phpunit` smoke test `/` returns 200 + contains root div; `composer validate --strict`.
- **M1.2 [BE]** E-commerce schema + models + factories: `customers`, `articles`, `orders`, `order_items`, `returns`, `email_campaigns`. Minimal, realistic columns matching preset base columns.
  - Guardrails [T]: migration + model unit tests; factory smoke.
- **M1.3 [BE]** Tabular schema: `tabular_reviews` (title, preset_key, row_source, columns_config json, tenant_id='demo'), `tabular_cells` (review_id, row_id, column_index, content json, flag, status, confidence, UNIQUE(review_id,row_id,column_index)), `workflows` (title, preset_key, columns_config json, is_system).
  - Guardrails [T]: migration tests; unique-constraint test.
- **M1.4 [BE]** `EcommerceDemoSeeder` (gated to local/testing) loading the exact rows from the 5 presets in `data.jsx` so Mock mode is pixel-faithful. `BuiltinWorkflowSeeder` for the 5 cooked scenarios + 16-format showcase.
  - Guardrails [T]: seeder idempotent; row counts match presets.
- **M1.5 [BE]** `config/ai.php` + Anthropic provider wiring for `laravel/ai`; default `claude-haiku-4.5`; `AI_MOCK=true` default.
  - Guardrails [T]: config test; verify max_tokens/temperature forwarded (finding #14) via a faked HTTP assertion.

### M2 — Backend Tabular engine  ·  branch `task/m2-engine`
- **M2.1 [BE]** `App\Support\TabularReview\{FormatType,CellFlag,CellStatus}` enums (port 17 formats + `promptSuffix()` + `isLlmFree()` from AskMyDocs).
  - Guardrails [T]: PHPUnit per format suffix (17), enum membership.
- **M2.2 [BE]** `RowContextBuilder`: serialize an entity row (+ cheap related data, e.g. customer return history) to the JSON context the LLM sees. `JsonPathResolver` (port `parseJsonPath`/`descend`/`stringify`).
  - Guardrails [T]: json_path resolves `$.a.b`, bracket notation, booleans→"true"/"false", missing→null.
- **M2.3 [BE]** `TabularReviewExtractor` (adapted): split json_path vs LLM cols; batched single LLM call per row → JSON-lines; parse; atomic upsert; R14 refusal; never leak provider errors; `$onCell` callback. **MockExtractor** path returns cooked preset cells with a small delay.
  - Guardrails [T]: batched-parse test, refusal test, malformed-line skip, upsert race (concurrent) test, mock path test.
- **M2.4 [BE]** `FlagClassifier` + pseudo-confidence mapping (finding #11).
  - Guardrails [T]: mapping tests.
- **M2.5 [BE]** REST API: `GET /api/reviews/{preset}` (hydrate review + rows + columns + existing cells), `PATCH /api/reviews/{id}/columns/{idx}` (edit/add column), `DELETE …`, `POST /api/reviews/{id}/columns` (add), `GET /api/suggest/{preset}` (AI-suggest cooked or live). `FormRequest` validation for column shape (format ∈ enum, json_path required iff format=json_path, enum_values iff enum).
  - Guardrails [T]: feature tests per endpoint + validation rejects bad format/shape.
- **M2.6 [BE]** **SSE endpoint** `GET /api/reviews/{id}/stream?cols=&force=` → `text/event-stream`; iterate rows, call extractor with `$onCell` echoing `event: cell\n data: {row,col,content,flag,confidence,status}`; emit `done`. Headers `X-Accel-Buffering: no`, `Cache-Control: no-cache`. Mock mode paces output.
  - Guardrails [T]: feature test asserts event-stream content-type + at least N `cell` events + terminal `done`; error row → red cell event, not 500.

### M3 — Frontend foundation + page shell  ·  branch `task/m3-shell`
- **M3.1 [FE]** Vite + React 19 + Tailwind v4 + TanStack Query setup; port design tokens (`styles.css`) into Tailwind theme + `tokens.css`; Geist fonts; dark/light + accent data-attributes.
  - Guardrails [T]: `vite build` passes; Vitest renders root; token smoke test.
- **M3.2 [FE]** Page composition (port `app.jsx`): `TopChrome`, `HeroBanner` (stats: rows, AI cols, cells, cost, latency), `PresetChips`, `ActionBar` (AI Suggest, Add column, Live/Mock toggle, Export, Share, Run all + progress), `StatusFooter` (recent citations).
  - Guardrails [T]: Vitest component tests (hero stats compute, chips render, action bar states running/idle); Playwright: page loads, hero + 5 chips visible, theme toggle works.
- **M3.3 [FE]** API client + TanStack Query hooks (`useReview(preset)`, mutations for column edit/add/delete, suggest). Single source-of-truth cell store keyed `row:col`.
  - Guardrails [T]: Vitest hook tests with mocked fetch; stale-response guard test (lesson #E).

### M4 — Glide Data Grid + renderers + streaming  ·  branch `task/m4-grid`
- **M4.1 [FE]** Integrate `@glideapps/glide-data-grid`; base cols + AI cols; sticky header with format icon, name, prompt preview, edit pencil, `$path` tag for json_path; row select; add-column ghost col; Tailwind-v4 theme mapping.
  - Guardrails [T]: Vitest grid mounts with columns; Playwright: grid renders, header shows prompt preview, pencil visible on AI cols.
- **M4.2 [FE]** 17 custom canvas cell renderers (fix prototype bugs #1, #2, #5): text, bulleted_list, number, percentage(bar+NaN guard), monetary_amount, currency, yes_no(pill), date, tag, enum(deterministic palette), enum_status(semantic palette), rating(stars), url(favicon+http guard), person(avatar), tags_multi(chips +N), relation(typed chip), json_path(auto-detect + `$` sigil). Confidence dot, citation badge (stable numbering), flag background tint, confidence tint.
  - Guardrails [T]: Vitest per-renderer snapshot/value tests (esp. percentage parsing, json_path auto-detect, url protocol guard); Playwright on the 16-format showcase preset asserts each renderer visible.
- **M4.3 [FE]** SSE consumer: single `EventSource`, atomic `gridRef.updateCells`, skeleton (`GridCellKind.Loading`) while generating, top progress bar, **run-token guard** so preset switch mid-run can't patch stale cells (fix #7). Stop/cancel.
  - Guardrails [T]: Vitest reducer test (cell event → store update, stale token ignored); Playwright: Run all → skeletons → cells fill → progress reaches 100% → footer citations populate.

### M5 — Column editor, AI Suggest, bulk ops, citation panel  ·  branch `task/m5-interactions`
- **M5.1 [FE]** Column editor drawer (port `editor.jsx`): label, 17-format picker grid, enum-values input (conditional), prompt textarea, Auto-generate, json_path help, cost estimate card. Save → PATCH → regenerate that column via SSE.
  - Guardrails [T]: Vitest editor logic (auto-generate per format, json_path hides prompt); Playwright: click column pencil → drawer → change prompt/format → Save → that column regenerates (skeletons then new values).
- **M5.2 [FE]** Add column (new) + delete column. AI Suggest popover (port): proposals per preset; pick → append column + generate.
  - Guardrails [T]: Vitest popover renders preset proposals; Playwright: AI Suggest → pick proposal → new column appears + fills; add column manual flow; delete column removes it.
- **M5.3 [FE]** Citation/cell side-panel (finding #19): click cell → panel with value, flag, reasoning, model, tokens, citation, prompt, Regenerate + Copy. Bulk select → "Regenerate selected" (finding #20).
  - Guardrails [T]: Playwright: click cell opens panel with citation; regenerate single cell; multi-select + bulk regenerate.

### M6 — Presets, workflows, polish, export  ·  branch `task/m6-presets`
- **M6.1 [BE/FE]** Wire the 5 cooked presets (Returns, Fraud, Articles SS26, Email, + 16-format showcase) end-to-end with their base+AI columns and cooked mock cells matching `data.jsx`. Preset chips switch row source + columns + cells.
  - Guardrails [T]: feature test each preset hydrates; Playwright: switch all 5 chips, each shows correct entity name + AI columns.
- **M6.2 [FE]** Polish: loading skeletons everywhere, empty states, toasts, responsive/no-overflow at 125%/150% zoom, a11y labels on icon buttons.
  - Guardrails [T]: Playwright a11y/zoom checks (no overflow), icon buttons have labels.
- **M6.3 [BE/FE]** CSV export (formula-neutralized, finding #22) replacing the alert stub; Share button stays a demo toast.
  - Guardrails [T]: export unit test (formula neutralization); Playwright export triggers download.

### M7 — CI, README, knowledge consolidation, release  ·  branch `task/m7-release`
- **M7.1** `.github/workflows/ci.yml`: PHP 8.4 + Node, `phpunit` + `vitest` (threads pool) + `vite build` + Playwright (chromium), artifacts on failure.
  - Guardrails: CI green on a trivial PR.
- **M7.2** **WOW community `README.md`** (top-tier OSS quality):
  - Header **badges** (License MIT, Laravel 13, React 19, Vite, Tailwind v4, PHP 8.3+, tests/CI, PRs welcome, `laravel/ai`).
  - **Banner** image right under the title: `resources/Tabular-Review-Banner.png`.
  - **Table of Contents**.
  - **The idea & the intuition** — narrate the "domino" moment from the article; the pattern is back-office triage, not just legal.
  - **What's innovative / fantastic** — 17 column formats, each column = a prompt, `json_path` zero-LLM bypass, batched JSON-lines streaming (cost O(rows)), canvas Glide grid, AI-Suggest, live cell-by-cell SSE, Mock-mode out-of-the-box.
  - **Mention & credit MikeOSS** (mikeoss.com, AGPL-3.0) as the originator of the Tabular Review pattern — *Adapt, don't adopt.*
  - **Screenshots**: `resources/Tabular-Review-Ai-suggested.png` (AI Suggest), `resources/Tabular-Review-Prompt-Column.png` (column prompt editor), plus the hero grid.
  - **Junior-proof step-by-step Quickstart** (clone → composer install → npm install → .env + sqlite → migrate+seed → npm run dev → open `/` → click a chip → Run all → edit a column → AI Suggest), each step copy-pasteable.
  - The 3 architecture decisions, how to flip Live mode (API key), demo data, full test gates.
- **M7.3** **Final knowledge task**: review `docs/LESSON.md` + everything learned; create/strengthen `.claude/skills`, `docs/RULES.md`, `AGENTS.md`, `CLAUDE.md` with the new know-how so nothing is lost.
- **M7.4** Tag `v0.1.0` and create the GitHub release.

---

## 4. Risks & open questions
- `laravel/ai` Anthropic agent option-forwarding (finding #14) — verify early in M1.5/M2.3; if options drop, replicate the AskMyDocs `*AnonymousAgent` subclass trick. Record in LESSON.
- Glide custom canvas renderers are the highest-effort, highest-risk piece (M4.2). Budget accordingly; lean on AskMyDocs `format-renderers` if found in its frontend.
- SSE + PHP built-in server / Herd buffering: confirm flushing works locally; document the working run command in LESSON.

---

## 5. Quick status pointer
See `docs/PROGRESS.md` for the live "where am I" log. Current: **M0 in progress** (governance scaffolding being written).
