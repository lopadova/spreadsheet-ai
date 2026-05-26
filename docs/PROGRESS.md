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

### Next
- **M0**: push `task/m0-governance` branch → run local Copilot review loop (DoD step 2, see `AGENTS.md`) → open PR → request GitHub Copilot review → merge when CI + Copilot green.
- Then **M1 — Laravel foundation**: scaffold Laravel 13 app, SQLite, `laravel/ai`, Blade+Vite shell, e-commerce schema + seeders, tabular schema. (See plan §3 M1.)

### Blockers
- **GitHub Copilot PR review not serviced on this repo.** PR #1: REST request accepted (`Copilot`) but `reviewRequests` clears instantly, no review posted after 12+ min. Feature not enabled/entitled for `lopadova/spreadsheet-ai`. Policy adopted: bounded wait (~3–5 min) on GitHub Copilot, then rely on local Copilot `/review` + green local tests as the binding gate. Owner can enable "Copilot code review" in repo settings to make the GitHub gate real. (See `docs/LESSON.md`.)
- License mismatch: repo is Apache-2.0, README/article say MIT → resolve in M7.

### M0 outcome (2026-05-26)
- PR #1 `task/m0-governance` → `main`: local Copilot `/review` passed (13 fixes), local gates N/A (docs only), GitHub Copilot review unavailable → merged under the bounded-wait policy.
