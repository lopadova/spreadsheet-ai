# LESSON.md — spreadsheet-ai

Non-obvious facts, fixes, and gotchas. Append dated entries (`YYYY-MM-DD`),
most recent first. Every new session and sub-agent should read this.

## 2026-05-26 — M2 local Copilot review findings (applied)
- **`JsonPathResolver::stringifyValue` dead branch** — `$encoded === false` after `JSON_THROW_ON_ERROR` is unreachable; removed.
- **`persistCell` fallback `json_encode` missing flag** — The degraded encode used `JSON_UNESCAPED_UNICODE` only; added `JSON_THROW_ON_ERROR` for consistency (content is hardcoded-safe primitives, won't throw).
- **`ColumnRequest` `enum_values` allows empty array** — The `requiredIf` only ensured the field was present, not non-empty. Added `'min:1'` rule. Docblock updated.
- **`StreamController` catch emitted only ONE red cell** — When `extractRow` throws unexpectedly, the catch block used `$columnIndexes[0] ?? 0` (only marks the first column). Fixed to fan out over all `$columnIndexes` (or all configured columns when null).
- **`emit()` json_encode false guard** — Without `JSON_THROW_ON_ERROR`, a failed encode would emit `data: false` and corrupt the stream. Added a `false` guard that skips the event.
- **`StreamController` catch missing log** — Added `Log::warning` so unexpected row throws are visible server-side.
- **`extractReview` `$force` is dead code** — Documented as reserved for future "skip READY cells" optimisation; currently a no-op (upsert always overwrites).

- **`QUEUE_CONNECTION` must be `sync` in `.env.example`** — Framework default is `database`, but RULES require `sync`. With `database` queue and no worker, queued jobs would silently never run. Fixed in `.env.example`.
- **`BuiltinWorkflowSeeder` must be gated to `local`/`testing`** — RULES say "demo seeders gate to local/testing environments." The builtin seeder was missing the env check. Fixed — identical gate to `EcommerceDemoSeeder`.
- **`TABULAR_SSE_PACING_MS` was absent from `.env.example`** — Listed as `env()` key in `config/tabular.php` but not documented in `.env.example`. Added.
- **No DB UNIQUE constraint on `workflows(tenant_id, preset_key)`** — The `updateOrCreate` in `BuiltinWorkflowSeeder` is application-level idempotency only. Sufficient for sync-queue demo; adding a DB constraint would require `WorkflowFactory` changes to avoid `(demo, returns)` duplicate violations in tests. Left for M2 if concurrency is introduced.
- **`parseDayMonth()` silent unknown-month fallback** — Returns '05' (May) for any unrecognized abbreviation. Safe for fixed demo data; would silently misbehave on dynamic data. Acceptable for M1.

## 2026-05-26 — M1 backend foundation (schema, models, seeders, config)
- `laravel/ai v0.6.7` has a built-in `anthropic` provider (config `vendor/laravel/ai/config/ai.php`); no custom provider needed. `config/ai.php` copied with `default => 'anthropic'`. Demo config in `config/tabular.php` (mock/provider/model/sse_pacing_ms/max_tokens/temperature).
- SQL reserved word: the returns table is named `returns_rows` (model `ReturnRow`) to avoid `returns`.
- Money: prototype amounts like `€2.149,00` are Italian-format (dot=thousands, comma=decimal). `EcommerceDemoSeeder::toCents()` strips non-numerics, drops dots when a comma is present, then ×100. Money stored as integer cents everywhere.
- Preset single source of truth: `app/Support/TabularReview/PresetData.php` ports all 5 presets (base_cols, ai_cols, rows, cooked cells normalized to `{value,flag,citation}`) from `data.jsx`. M2 mock extractor will read cooked cells from here.
- Seeded counts (asserted in `SeederTest`): 24 customers, 24 orders (10 fraud + 14 `ORD-R*`), 14 return rows, 16-format showcase workflow present; 5 system workflows. Idempotent via `updateOrCreate` (incl. `WHERE article_id IS NULL` for order_items).
- `php artisan test` is intercepted by a hook emitting a JSON line; for a human-readable per-test breakdown run `vendor/phpunit/phpunit/phpunit --testdox` via Herd PHP.
- Laravel 13 skeleton uses attribute-based model config (`#[Fillable]`); domain models use the conventional `protected $fillable` + `casts()` style — both valid.

## 2026-05-26 — M1 frontend foundation (React 19 + Vite 8 + Tailwind v4)
- **Windows case-insensitive FS**: `app.tsx` (Vite entry) and `App.tsx` collide as the same file. Component lives in `resources/js/AppRoot.tsx`; entry `app.tsx` imports `./AppRoot`.
- **Vitest 3.2.4 bundles Vite 7 (rollup); project runs Vite 8 (rolldown)** → `@vitejs/plugin-react` Plugin types diverge and break `tsc`. Runtime fine; cast the plugins array to `ViteUserConfig['plugins']` in `vitest.config.ts`. Drop when Vitest ships Vite 8.
- **CSS `@import` order**: Google Fonts `@import url(...)` must precede `@import 'tailwindcss';` or the build warns ("@import rules must precede all rules").
- **Playwright e2e prereq**: `npm run build` must run before `npm run e2e` (Playwright serves built Vite assets via the manifest). The `/` route is DB-free so e2e is independent of backend migrations. Playwright auto-starts `artisan serve` on 127.0.0.1:8123 (`reuseExistingServer`), chromium-only.
- **composer.bat in background PowerShell** failed with a generic "file not found"; calling `php84\php.exe composer.phar …` explicitly works. Also a malformed version constraint can create a stray file named after the constraint (`0.6`) — delete it.

## 2026-05-26 — Seeded from source analysis (before any code)

### `laravel/ai` SDK surface (from AskMyDocs `app/Ai`)
- **Version pin `>=0.6,<0.6.8`**: upper bound set at scaffolding time (reason TBD — no confirmed breaking change in 0.6.8 yet). Re-evaluate before M2: run the test suite against `0.6.8+` and widen the constraint if clean.
- Real classes: `Laravel\Ai\AnonymousAgent`, `Laravel\Ai\Messages\{UserMessage,AssistantMessage}`, `Laravel\Ai\Gateway\TextGenerationOptions::forAgent()`, response `Laravel\Ai\Responses\AgentResponse` (`->text`, `->usage->{promptTokens,completionTokens}`, `->meta->model`, `->steps->last()?->finishReason`).
- **GOTCHA**: `TextGenerationOptions::forAgent()` reads `maxTokens()`/`temperature()` from the agent instance. A plain `AnonymousAgent` exposes neither, so caller-supplied `max_tokens`/`temperature` are silently dropped. AskMyDocs subclassed it (`RegoloAnonymousAgent`) to add the methods. → Verify our agent forwards options; add a faked-HTTP test asserting `max_tokens`/`temperature` reach the wire. If dropped, replicate the subclass trick.
- AskMyDocs wraps everything in `App\Ai\AiManager` with `chat(string $system, string $user, array $options): AiResponse` and `chatStream(...)`. We can build a slimmer `AiManager` for the demo.

### Extractor patterns worth copying (AskMyDocs `TabularReviewExtractor`)
- Split columns into json_path (LLM-free) vs LLM batch. One batched call per row → newline-delimited JSON, one object per `column_index`.
- Persist via `Model::upsert([...], uniqueBy: [...], update: [...])` then re-`first()` — `updateOrCreate` is NOT atomic and races on the composite UNIQUE.
- Encode content with `JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE`; on `JsonException` degrade to a red cell (Postgres rejects invalid JSON; SQLite would store `""`).
- Never put the provider exception message in the persisted/returned cell — log it, return "provider error". (Leaks hostnames/keys otherwise.)
- `parseJsonPath` accepts `$.a.b`, `a.b`, and `$['a']['b']`; `descend()` walks arrays; booleans stringify to `"true"/"false"` (PHP `(string) false` is `""`, which loses the value).

### Prototype bugs to fix when porting (`tabular-review-demo/project`)
See `docs/plan.md §1.A` for the full annotated list (findings 1–9 with task assignments). Quick summary: `RJsonPath` stub, unstable citation numbering, `{v}` vs `{value,flag,citation}` DTO mismatch, fragile `RPercentage` parsing, preset mid-run stale-cell race.

### Design tokens (`project/styles.css`)
- Geist Sans + Geist Mono. Dark default. Accent violet (oklch). Status palette: success `#10b981`, paused/yellow `#f59e0b`, failed/red `#ef4444`, grey tertiary. Row height 40px, radii 4/6/8px. Reproduce in Tailwind v4 theme + a `tokens.css`.

### Reference repo process gotchas (`product_image_discovery_admin/docs/LESSON.md`)
- Windows: `php`/`composer` may be off PATH; Herd PHP at `%USERPROFILE%\.config\herd\bin\php84\php.exe`; set `PHP_BINARY`. Don't use XAMPP.
- Creating `.agents/skills/` was sandbox-blocked there; they used a repo-local `skills/` dir. We use `.claude/skills/` and fall back to `skills/` if blocked.
- Copilot reviewer request can fail before requesting if token lacks `read:project` → GraphQL `requestReviewsByLogin` fallback.
- Vite/Vitest on Windows: `spawn EPERM` issues fixed by recent Vite/Vitest; use `pool: 'threads'` (forks still spawned child processes).
- CI must make demo data deterministic (fake providers / mock LLM) — our Mock mode is the determinism lever for Playwright.

### Local Copilot CLI behavior (`copilot --autopilot --yolo`)
- It is **agentic**: it not only reviews but **edits files and even runs `git add -A` + `git commit` itself** to apply fixes. Expect a self-authored commit after the run.
- **GOTCHA**: its `git add -A` swept the temporary `.review-diff.patch` into a commit. → Always `.gitignore` the diff artifact BEFORE running it (now ignored via `.gitignore`), or write the diff outside the repo.
- Argument list limit: passing the full diff inline (`$(git diff …)`) overflows the OS arg limit on large diffs → write the diff to a gitignored file and tell Copilot to read it.
- It consumes premium requests/tokens; one M0 docs review = ~2 premium requests, ~9 min.

### Requesting GitHub Copilot PR review — the method that ACTUALLY works
- ✅ Works: REST `gh api --method POST repos/<owner>/<repo>/pulls/<PR>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'`. Verified on PR #1 — Copilot bot (login `Copilot`, type Bot, app `copilot-pull-request-reviewer`) lands in `requested_reviewers`.
- ❌ `gh pr edit <PR> --add-reviewer @copilot` returns exit 0 but is a **silent no-op** (reviewRequests stays empty). Do not trust its exit code.
- ❌ There is no `requestReviewsByLogin` GraphQL mutation (the reference repo's note was inaccurate). Use the REST endpoint above.
- Verify with `gh pr view <PR> --json reviewRequests`.

### GitHub Copilot PR review is NOT serviced on this repo (blocker → policy)
- On PR #1 the REST request returns `Copilot` (accepted) but `reviewRequests` empties **immediately** and **no review is ever posted** (waited 12+ min). The bot is added then instantly dropped → GitHub "Copilot code review" is not enabled / not entitled for `lopadova/spreadsheet-ai`.
- **Adopted policy (bounded wait):** still fire the REST request on every PR (cheap), but wait at most ~3–5 min. If no Copilot review materializes, treat the **local Copilot `/review` + green local tests** as the binding review gate, record it in PROGRESS, and proceed. Do NOT deadlock the roadmap on an unavailable external feature.
- To enable later: the repo owner can turn on Copilot code review in repo/org settings (needs a Copilot subscription that includes automated PR review). Once enabled, the GitHub-side gate becomes real again.

### Repo license mismatch (TODO M7)
- The GitHub repo was initialized with **Apache-2.0** (`LICENSE`), but the article/README badges say **MIT**. Decide in M7: align README badges to Apache-2.0, or relicense to MIT. Don't claim MIT in the README until resolved.

### Review workflow — two-phase Copilot (rationale)
Phase 1 = local Copilot review before push; Phase 2 = GitHub Copilot PR review after push.
Full workflow (commands + fallbacks): see `AGENTS.md §Branch & PR loop` and `docs/RULES.md §Review rules`.
Rationale (user, 2026-05-26): catch issues locally first → cheaper iterations, cleaner PRs.

### Architecture decisions (locked)
- SQLite, synchronous SSE (no Redis), Mock-default + Live toggle. Confirmed by user 2026-05-26. Rationale: zero-setup clonable demo.
