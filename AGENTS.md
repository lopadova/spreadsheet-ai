# AGENTS.md — spreadsheet-ai (Tabular Review demo)

Operating instructions for any AI agent (Claude / Copilot / sub-agents) working
in this repository. Read this fully before acting. Then read, in order:
`docs/plan.md`, `docs/PROGRESS.md`, `docs/LESSON.md`, `docs/RULES.md`.

## Project identity
A functioning single-page demo of an **agentic spreadsheet** ("Tabular Review"):
rows = e-commerce entities, columns = LLM prompts, cells = AI values with
confidence flag + citation. Laravel 13 + React/Vite/Tailwind + Glide Data Grid,
LLM via the `laravel/ai` SDK. See `docs/plan.md` §0 for the full brief and the
three locked architecture decisions (SQLite · synchronous SSE no-Redis · Mock
default + Live toggle).

## Required context files (every session, every sub-agent)
- `docs/plan.md` — canonical plan + deep analysis + task breakdown.
- `docs/PROGRESS.md` — live "where am I" log. Update after meaningful work.
- `docs/LESSON.md` — non-obvious facts / fixes. Update whenever you learn one (including from Copilot feedback).
- `docs/RULES.md` — binding implementation/security/testing/review rules.

## Reference sources (do not re-derive — read them)
- Article: `%USERPROFILE%\Downloads\medium\SpreadsheetAi\article-bozza-italiano.md`
- Design prototype (pixel reference): `%USERPROFILE%\Downloads\SpreadsheetAi\tabular-review-demo\project\`
- Backend patterns to copy: `%USERPROFILE%\Documents\DocLore\Visual Basic\Ai\AskMyDocs` (`app/Support/TabularReview/FormatType.php`, `app/Services/TabularReview/TabularReviewExtractor.php`, `app/Ai/AiManager.php`).
- Governance template: `%USERPROFILE%\Documents\DocLore\Visual Basic\Ai\product_image_discovery_admin`.

## Branch & PR loop (mandatory)
- One **branch per macro task** (`task/m1-foundation`, `task/m2-engine`, …). Subtasks branch off and PR **into the macro branch**; finished macro branch PRs **into `main`**.
- **A (sub)task is DONE only when, in this order:**
  0. **Define objective + guardrails as tests** before writing implementation code (TDD).
  1. **Local tests loop** — all green: `phpunit`, `vitest`, `vite build`, and — for any UI/UX work — **Playwright scenarios covering every interaction**. Fix until green.
  2. **Local Copilot review loop** (BEFORE any push) — run the local Copilot CLI against the *complete* branch diff vs `origin/main`, fix everything it flags, re-run, loop until clean. See the exact command below.
  3. Push the branch; open PR toward the working branch.
  4. **GitHub Copilot** requested as reviewer and its review confirmed started.
  5. **GitHub CI + Copilot loop** — wait for both CI green **and** Copilot comments; fix broken tests + comments, push, re-request Copilot review, loop until all green.
  6. All green → merge. Record findings in `docs/LESSON.md`; update `docs/PROGRESS.md`. Only then move to the next task.
- Pure-code tasks: PHPUnit/Vitest suffice. UI/UX tasks: Playwright is required too.

### Local Copilot review (step 2 — before push)
Run the Copilot CLI in autopilot and pass it the **full branch diff vs `origin/main`** as context, invoking the **`/review`** skill explicitly (do NOT rely on open files or just changed-branch files — give it the complete diff so it has context):

```bash
copilot --autopilot --yolo -p "/review the following COMPLETE diff of the current branch against origin/main. Check thoroughly for regressions, bugs, bad practices, security issues, and possible improvements, and report concrete fixes:

$(git diff origin/main...HEAD)"
```

Fix every legitimate finding, re-run the local tests, re-run this local review, and loop until clean. Only then push. Record non-obvious findings in `docs/LESSON.md`.

### Requesting GitHub Copilot review (step 4 — fallback)
Prefer `gh pr edit <PR> --add-reviewer @copilot`. If the token lacks `read:project`
this can fail before requesting — fall back to the GraphQL `requestReviewsByLogin`
mutation with `botLogins: ["copilot-pull-request-reviewer[bot]"]` and `union: true`.
Do NOT substitute `@codex review` unless the user explicitly asks.

## Sub-agent strategy
- Spawn sub-agents for disjoint write scopes (backend vs frontend). Hand each one `docs/LESSON.md` + `docs/plan.md` + `docs/RULES.md` + this file in its prompt.
- Keep one integrator agent responsible for the final gates and the merge.
- Worker write scopes must not overlap.

## Environment (Windows / Herd)
- Use **Herd PHP** (`%USERPROFILE%\.config\herd\bin\php84\php.exe`), not XAMPP. Set `PHP_BINARY` if `php` is not on PATH. (Herd PHP 8.4 satisfies the `^8.3` composer constraint.)
- Run the PHPUnit gate through an `npm run phpunit` wrapper (`scripts/run-php.mjs`) to avoid stale PATH / XAMPP resolution.
- Vitest in CI: `pool: 'threads'`, `LARAVEL_BYPASS_ENV_CHECK=1`. Validate lockfiles with `npx npm@10 ci --dry-run`.
- If a gate is blocked by sandbox/network, record the exact blocker in `docs/PROGRESS.md` — do not silently skip.
- **Skill directory**: the resume skill lives at `.claude/skills/spreadsheet-ai-plan/SKILL.md`. If `.claude/skills/` is sandbox-blocked, fall back to a repo-local `skills/` directory.

## Final task
After all macro tasks, fold `docs/LESSON.md` learnings back into `docs/RULES.md`,
the skills, this file, and `CLAUDE.md`, then tag `v0.1.0` and cut the GitHub release.
