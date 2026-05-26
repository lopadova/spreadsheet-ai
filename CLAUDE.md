# CLAUDE.md — spreadsheet-ai

Project memory for Claude Code. Keep concise. Authoritative process lives in
`AGENTS.md` + `docs/RULES.md` + `docs/plan.md`; read those before working.

## What this is
A functioning single-page demo of an **agentic spreadsheet** (Tabular Review):
rows = e-commerce entities, columns = LLM prompts, cells = AI values + confidence
flag + citation. Laravel 13 + React/Vite/Tailwind + Glide Data Grid + `laravel/ai`.

## Locked decisions
- DB: **SQLite** (`database/database.sqlite`). Rows seeded from the 5 demo presets.
- Streaming: **synchronous SSE, no Redis/Horizon**.
- LLM: **Mock by default + Live toggle** (`laravel/ai`, Anthropic `claude-haiku-4.5`).
- Pixel target: the rendered design in `resources/Tabular-Review-Banner.png` and the prototype in `%USERPROFILE%\Downloads\SpreadsheetAi\tabular-review-demo\project\`.

## How to work here
- Read on every session: `docs/plan.md`, `docs/PROGRESS.md`, `docs/LESSON.md`, `docs/RULES.md`, `AGENTS.md`.
- Branch per macro task; subtask PRs into the macro branch; macro PR into `main`.
- A task is done only when phpunit + vitest + vite build (+ Playwright for UI) are green, a PR is open, Copilot review ran, CI + Copilot are green, then merge. Loop on failures.
- Update `docs/PROGRESS.md` after meaningful work; update `docs/LESSON.md` on any non-obvious learning (including Copilot feedback).

## Conventions
- Controllers read `config()`, never `env()`.
- Never leak provider error messages / secrets in API responses or UI.
- Cell content JSON-encoded with `JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE`; degrade to a red cell on failure.
- Persist cells via atomic upsert keyed `(review_id, row_id, column_index)`.
- `url` cells: only `http:`/`https:`; CSV export: neutralize `= + - @` formula prefixes.
- Dense UI, radius ≤ 8px, no nested cards, every icon button has an aria-label/title.
- Windows/Herd: use Herd PHP 8.4, not XAMPP; run phpunit via the `npm run phpunit` wrapper.

## 17 column formats (single source of truth = `FormatType` enum)
text · bulleted_list · number · percentage · monetary_amount · currency · yes_no ·
date · tag · enum · enum_status · rating · url · person · tags_multi · relation ·
json_path (LLM-free, resolves against the row JSON).
