# LESSON.md — spreadsheet-ai

Non-obvious facts, fixes, and gotchas. Append dated entries (`YYYY-MM-DD`),
most recent first. Every new session and sub-agent should read this.

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

### Repo license mismatch (TODO M7)
- The GitHub repo was initialized with **Apache-2.0** (`LICENSE`), but the article/README badges say **MIT**. Decide in M7: align README badges to Apache-2.0, or relicense to MIT. Don't claim MIT in the README until resolved.

### Review workflow — two-phase Copilot (rationale)
Phase 1 = local Copilot review before push; Phase 2 = GitHub Copilot PR review after push.
Full workflow (commands + fallbacks): see `AGENTS.md §Branch & PR loop` and `docs/RULES.md §Review rules`.
Rationale (user, 2026-05-26): catch issues locally first → cheaper iterations, cleaner PRs.

### Architecture decisions (locked)
- SQLite, synchronous SSE (no Redis), Mock-default + Live toggle. Confirmed by user 2026-05-26. Rationale: zero-setup clonable demo.
