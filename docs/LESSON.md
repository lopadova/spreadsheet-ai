# LESSON.md — spreadsheet-ai

Non-obvious facts, fixes, and gotchas. Append dated entries (`YYYY-MM-DD`),
most recent first. Every new session and sub-agent should read this.

## 2026-05-26 — CI (first real run) gotchas
- **phpunit before build → ViteManifestNotFoundException**: a feature test hitting `/` renders `app.blade.php` (`@vite()`), which needs `public/build/manifest.json`. CI runs phpunit before `npm run build` → 500. Fix: `$this->withoutVite()` in any view-rendering feature test (don't depend on built assets). Verified by removing `public/build` locally.
- **`npm ci` fails on Linux CI with a Windows-generated lockfile**: "Missing: @emnapi/core@… from lock file" — the lockfile (npm 11, Windows) omits Linux-only optional native deps (transitive of Vite 8 / rolldown). Fix: use `npm install --no-audit --no-fund` in CI instead of `npm ci`. (Reference repo hit similar npm/lockfile cross-version issues.)
- CI triggers on both `pull_request` and `push` → two runs per PR; both must be green.

## 2026-05-26 — M5 interactions local review findings (applied)

- **`ColumnEditor` missing Escape handler + initial focus**: `role="dialog" aria-modal="true"` without an Escape listener is an ARIA violation. Fixed: added `useEffect` on `[open, onClose]` that attaches/removes a `keydown → Escape → onClose()` handler. Also added `autoFocus` on the Label input so focus lands inside the drawer on open.
- **`CellSidePanel` missing Escape handler**: `<aside>` panels should close on Escape. Fixed: same `useEffect` pattern on `[open, selection, onClose]`.
- **`autoGenerate` setTimeout not cancelled on re-click**: If the user clicks "Auto-generate" twice quickly, two overlapping timers ran (second would overwrite first). Fixed: store the timer ID in a `useRef<number | null>` and `clearTimeout` before scheduling a new one.
- **`window.setTimeout` return type vs Node `Timeout`**: `autogenTimerRef` initially typed as `ReturnType<typeof window.setTimeout>` which TypeScript (with `"types": ["node"]` in tsconfig) resolves to `NodeJS.Timeout` instead of `number`. Fix: type as `number | null` explicitly. Note: the tsconfig `"types": [...]` array includes `"node"`, which shadows the browser `setTimeout` return type for `ReturnType<typeof window.setTimeout>` in ambiguous contexts.
- **`React.CSSProperties` in `AiSuggestPopover` without React import** — Works at runtime (and typecheck passes) because `@types/react` is a transitive dependency and TypeScript resolves the `React` namespace. But it is fragile and relies on ambient injection. Marked as risky (no change needed now; watch for `isolatedModules` stricter enforcement).
- **`pendingRegenRef` index prediction after deletes (risky — not applied)**: `newIndex = aiColumns.length` is correct only when the server assigns `column_index` equal to the current count (no gaps from prior deletes). If the server ever reuses indices or skips, the effect would wait forever. For the demo (no concurrent add+delete sequences), this is safe. Verify `ColumnController::store` always appends at `count(ai_columns)`.
- **`pendingRegenRef` single-slot race (risky — not applied)**: Two rapid add-column mutations would overwrite the ref; only the second column would auto-regenerate. Acceptable for the demo; a queue would be needed for production.


- **`drawPercentage` — zero-width fill bar path**: when `pct = 0` (null value or explicit 0), `roundRect` was called with `w = 0` → degenerate path drawn to canvas (harmless but invalid). Fixed: guard `if (pct > 0)` before drawing the fill bar.
- **`drawJsonPath` — unused `theme` destructuring + `void theme` suppression**: `theme` was extracted from `d` but never used directly (it flows through `{ ...d }` to sub-renderers). Removed the destructure; `void theme` suppression no longer needed.
- **Citation registry clear: `useEffect` (async) vs. render-time (sync)**: using `useEffect` to clear the `CitationRegistry` on preset change means the registry is cleared AFTER the first render with the new preset, potentially assigning citation indices starting from the old `next` counter rather than 1. Fixed: replaced `useEffect` with a render-phase previous-value comparison (`prevPresetRef`) so the registry is cleared synchronously before `getCellContent` is called for the new preset. Removed the now-unused `useEffect` import from `AgenticGrid.tsx`.
- **Unused `export { cellKey }` in `useSseGeneration.ts`**: `cellKey` was re-exported from `useSseGeneration` (which imported it from `store/cells`) but had no consumers. Removed. Also removed the now-unused `cellKey` import.
- **Unused deps `lodash`, `react-responsive-carousel`, `@types/lodash` in `package.json`**: none are imported anywhere in the M4 codebase. Removed. `marked` left (likely for M5 citation panel markdown rendering).
- **EventSource lifecycle — confirmed correct**: `closeStream` is called on stop, unmount, and preset/review change (via the `[reviewId]` effect). The run-token guard drops any in-flight events with a stale token. No leak possible.
- **`globalAlpha` in `drawRating` — confirmed correct**: `ctx.globalAlpha = 1` is restored after the star loop; outer `ctx.save()/restore()` also covers it.
- **`roundRect` with `w = 0` produces `rr = 0`** (all arcTo calls degenerate to straight lines) — the path itself doesn't crash but fill draws nothing visible. The `pct > 0` guard above fixes the one case that matters.
- **Risky — not applied**:
  - The chunk-size warning (`app.js > 500 kB`) is pre-existing; Glide Data Grid is large. Consider lazy-loading the grid or code-splitting in M7.
  - `marked` in `package.json` is a forward-declare for M5 citation panel; verify and remove if not used by end of M5.


- **`ToastContext.Provider value={{ push }}`** created a new object every render, causing every `useToast()` consumer to re-render on any toast state change. Fixed: extracted `api = useMemo(() => ({ push }), [push])` and passed that as the context value.
- **`setTimeout` IDs in `ToastProvider` not tracked** — unmounting before timer fire would leak a stale `setToasts` call. Fixed: `timers = useRef<Map<string, timeout>>` stores each timer ID; a cleanup `useEffect` calls `clearTimeout` on all pending timers on unmount. The timer map entry is deleted when the timeout fires naturally.
- **`onPickSuggestion` in `TabularPage` not memoized** — inline arrow function recreated every render; now `useCallback([toast])` wraps it. With `toast` stable (after context fix above), the prop passed to `ActionBar` is now stable across renders.
- **Risky — not auto-applied:**
  - `useUpdateColumn`/`useDeleteColumn` `onError` cast `context as { previous?: ReviewResponse }` — TanStack Query v5 infers context from `onMutate` return, but the explicit `UseMutationResult<…>` return type annotation omits the 4th (context) generic, forcing the cast. Typing it fully is a larger refactor; defer to M4/M5 when these mutations are wired up.
  - `TopChrome` nav links use `href="#"` with `preventDefault` — screen readers announce these as links. Replace with `<button>` elements in M5 when real routes exist.


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

### GitHub Copilot PR review — slow/intermittent, NOT "unavailable" (bounded-wait policy REVOKED)
- PR #1 looked unavailable (request cleared, no review), but PR #3 later DID show a review → Copilot review **is** serviced, just **slow/intermittent**, can take minutes; an early empty `reviewRequests` does not mean "never".
- **CORRECTED POLICY (user directive 2026-05-26):** the "bounded-wait, merge anyway" policy is **REVOKED**. Merge ONLY when **GitHub Actions CI is green AND a Copilot review has actually posted with zero unresolved comments**. Poll for minutes; re-request via REST if needed; never merge early.
- REST request method correct: `gh api --method POST repos/<owner>/<repo>/pulls/<PR>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'`; `gh pr edit --add-reviewer @copilot` is a silent no-op.

### DEBT: PRs #2–#5 merged before CI existed + without waiting for Copilot
- CI (`.github/workflows/ci.yml`) was added at M5 (brought forward from M7). PRs #2–#5 (M1–M4) merged with only LOCAL gates + local Copilot review, without waiting for GitHub Copilot. `main` is locally green; CI validates it from M5 on. Strict CI+Copilot gate applies from M5 onward.

### Repo license mismatch (TODO M7)
- The GitHub repo was initialized with **Apache-2.0** (`LICENSE`), but the article/README badges say **MIT**. Decide in M7: align README badges to Apache-2.0, or relicense to MIT. Don't claim MIT in the README until resolved.

### Review workflow — two-phase Copilot (rationale)
Phase 1 = local Copilot review before push; Phase 2 = GitHub Copilot PR review after push.
Full workflow (commands + fallbacks): see `AGENTS.md §Branch & PR loop` and `docs/RULES.md §Review rules`.
Rationale (user, 2026-05-26): catch issues locally first → cheaper iterations, cleaner PRs.

### Architecture decisions (locked)
- SQLite, synchronous SSE (no Redis), Mock-default + Live toggle. Confirmed by user 2026-05-26. Rationale: zero-setup clonable demo.
