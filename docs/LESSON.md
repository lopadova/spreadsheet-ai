# LESSON.md — spreadsheet-ai

Non-obvious facts, fixes, and gotchas. Append dated entries (`YYYY-MM-DD`),
most recent first. Every new session and sub-agent should read this.

## 2026-05-26 — Seeded from source analysis (before any code)

### `laravel/ai` SDK surface (from AskMyDocs `app/Ai`)
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
- `RJsonPath` renderer is a stub that always renders as percentage — must auto-detect type.
- Citation numbering recomputed globally every render (O(rows×cols)) and unstable — make per-cell stable.
- AI-Suggest fake cells use `{v}` shape while LLM path uses `{value,flag,citation}` — normalize on one DTO.
- `RPercentage` parsing is fragile (`+18%`/`-42%`/bare) — centralize + guard `NaN` before color/width.
- Preset switch mid-run can patch stale cells — add a run-token/abort guard.

### Design tokens (`project/styles.css`)
- Geist Sans + Geist Mono. Dark default. Accent violet (oklch). Status palette: success `#10b981`, paused/yellow `#f59e0b`, failed/red `#ef4444`, grey tertiary. Row height 40px, radii 4/6/8px. Reproduce in Tailwind v4 theme + a `tokens.css`.

### Reference repo process gotchas (`product_image_discovery_admin/docs/LESSON.md`)
- Windows: `php`/`composer` may be off PATH; Herd PHP at `%USERPROFILE%\.config\herd\bin\php84\php.exe`; set `PHP_BINARY`. Don't use XAMPP.
- Creating `.agents/skills/` was sandbox-blocked there; they used a repo-local `skills/` dir. We use `.claude/skills/` and fall back to `skills/` if blocked.
- Copilot reviewer request can fail before requesting if token lacks `read:project` → GraphQL `requestReviewsByLogin` fallback.
- Vite/Vitest on Windows: `spawn EPERM` issues fixed by recent Vite/Vitest; use `pool: 'threads'` (forks still spawned child processes).
- CI must make demo data deterministic (fake providers / mock LLM) — our Mock mode is the determinism lever for Playwright.

### Review workflow (locked) — two-phase Copilot
- **Phase 1, local (before push)**: `copilot --autopilot --yolo -p "/review <full diff> ..."`. Must pass the COMPLETE branch diff (`git diff origin/main...HEAD`) and invoke the `/review` skill explicitly — NOT just open files or changed-branch files, so Copilot has full context. Ask it for regressions, bugs, bad practices, security issues, improvements. Loop (fix → re-test → re-review) until clean.
- **Phase 2, GitHub (after push/PR)**: request Copilot reviewer on the PR (GraphQL `requestReviewsByLogin` fallback), wait for CI + comments, loop.
- Rationale (user, 2026-05-26): catch issues locally first → cheaper iterations, cleaner PRs.

### Architecture decisions (locked)
- SQLite, synchronous SSE (no Redis), Mock-default + Live toggle. Confirmed by user 2026-05-26. Rationale: zero-setup clonable demo.
