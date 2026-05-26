---
name: spreadsheet-ai-plan
description: Resume or continue the spreadsheet-ai Tabular Review demo (Laravel 13 + React/Vite/Tailwind + Glide Data Grid + laravel/ai). Use when working in the spreadsheet-ai repo, when context was lost, when following the saved plan, or when enforcing the branch/PR/Copilot-review/testing/security/UI rules for this project.
---

# spreadsheet-ai — resume skill

You are building a **functioning single-page demo of an agentic spreadsheet**
("Tabular Review"): rows = e-commerce entities, columns = LLM prompts, cells =
AI values with confidence flag + citation. Stack: Laravel 13 + SQLite +
`laravel/ai`, React 19 + Vite + Tailwind v4 + Glide Data Grid, synchronous SSE,
Mock-default + Live LLM toggle.

## Start here (read in order, every time)
1. `AGENTS.md` — operating instructions + the branch/PR/Copilot loop.
2. `docs/plan.md` — canonical plan, deep analysis (§1), task breakdown (§3, M0–M7).
3. `docs/PROGRESS.md` — where the last session stopped; resume from the top.
4. `docs/LESSON.md` — non-obvious facts/fixes (incl. `laravel/ai` option-forwarding gotcha, extractor upsert race, prototype renderer bugs).
5. `docs/RULES.md` — binding implementation/security/testing/review/UI rules.

## External references (read, don't re-derive)
- Article: `%USERPROFILE%\Downloads\medium\SpreadsheetAi\article-bozza-italiano.md`
- Design prototype (pixel reference + presets + 17 renderers + CSS tokens): `%USERPROFILE%\Downloads\SpreadsheetAi\tabular-review-demo\project\`
- Backend patterns to copy: `%USERPROFILE%\Documents\DocLore\Visual Basic\Ai\AskMyDocs`
- Governance template: `%USERPROFILE%\Documents\DocLore\Visual Basic\Ai\product_image_discovery_admin`
- Screenshots for README: `resources/Tabular-Review-Banner.png`, `…-Ai-suggested.png`, `…-Prompt-Column.png`

## Procedure
1. Read current state (above). Scope to the current macro task / subtask from `docs/plan.md` §3.
2. Implement on a branch (`task/m{N}-{slug}`); subtasks PR into the macro branch.
3. Define guardrails as tests up front: PHPUnit (backend), Vitest (frontend), and Playwright scenarios for **every** UI/UX interaction.
4. Definition of Done — canonical 7-step version in `docs/plan.md §2`; summary here:
   a. **Define guardrails as tests** up front before implementation.
   b. **Local tests** green (phpunit, vitest, vite build, Playwright for UI).
   c. **Local Copilot review** (before push): see `AGENTS.md §Local Copilot review` for the exact command. Fix + re-run + loop until clean.
   d. Push → open PR → request **GitHub Copilot** review via REST `gh api --method POST repos/<owner>/<repo>/pulls/<PR>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'` (confirm via `reviewRequests`).
   e. **MANDATORY — never merge early**: wait for **GitHub Actions CI green** AND a **posted Copilot review with zero open comments**. Poll for minutes if needed. CI red or Copilot comments → fix, push, re-request, loop.
   f. Merge ONLY when CI green AND Copilot zero open comments. Record findings in `docs/LESSON.md`; update `docs/PROGRESS.md`.
5. After each meaningful step: update `docs/PROGRESS.md`. On any non-obvious learning (incl. Copilot feedback): update `docs/LESSON.md`.

## Macro task order
M0 governance (done first) → M1 Laravel foundation + DB + seeders + ai config →
M2 backend engine (FormatType, extractor, json_path, SSE) → M3 frontend shell →
M4 Glide grid + 17 renderers + SSE consumer → M5 column editor + AI Suggest +
bulk + citation panel → M6 presets/workflows/polish/export → M7 CI + WOW README +
knowledge consolidation + tag `v0.1.0` & GitHub release.

## Hard rules (quick)
- Controllers use `config()`, never `env()`. Never leak provider errors/secrets.
- Atomic cell upsert keyed `(review_id,row_id,column_index)`; encode JSON with `JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE`, degrade to red on failure.
- `url` cells: `http:`/`https:` only. CSV export: neutralize `= + - @`.
- Windows/Herd PHP 8.4 (satisfies `^8.3`), not XAMPP; phpunit via `npm run phpunit` wrapper. Vitest `pool: threads`.
- Final task: fold `docs/LESSON.md` into rules/skills/AGENTS.md/CLAUDE.md before tagging the release.
