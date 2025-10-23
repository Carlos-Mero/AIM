# Repository Guidelines

## Project Structure & Module Organization
- Backend (Rust): `src/` with `main.rs`, `aim.rs`, `agents.rs`, `sessions.rs`, and `server/` for HTTP routes. Runtime artifacts: `aim.db` and `logs/`. Build output in `target/`.
- Frontend (Next.js): `frontend/` with `public/` assets and `src/` components. See script aliases in `frontend/package.json`.
- Research Integration: `deer-flow/` is a git submodule used to fetch literature context. It is optional for building the backend.

## Build, Test, and Development Commands
- Backend
  - `cargo build --release` – build the `aim` binary.
  - `cargo run -- --help` – run CLI; add `--server` to start HTTP API (port 4000).
  - `cargo test` – run Rust tests.
  - `cargo fmt --all` and `cargo clippy --all-targets -- -D warnings` – format and lint.
- Frontend
  - `cd frontend && npm install` – install deps.
  - `npm run dev` | `npm run build` | `npm run start` | `npm run lint` – develop, build, serve, lint.
- Deer-Flow
  - `git submodule init && git submodule update`; then follow `deer-flow/README.md` (e.g., `uv run main.py`).

## Coding Style & Naming Conventions
- Rust (edition 2024): 4-space indent, `rustfmt` defaults. Files/modules `snake_case`; types `CamelCase`; functions `snake_case`. Prefer `Result<T, E>` returns and clear error messages. Use existing logging (`log`/`tracing`) consistently.
- Frontend: TypeScript, Next 15. Use ESLint (`next lint`) and prefer Tailwind utility classes where present. Avoid `any`; type props explicitly.

## Testing Guidelines
- Rust unit tests co-located via `#[cfg(test)] mod tests { ... }`; integration tests in `tests/`. Run with `cargo test`.
- Frontend tests are not yet configured; add only if necessary and document how to run them.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, and `feat!` for breaking changes (see `git log`).
- PRs must include: concise description and scope, linked issues, local run instructions, screenshots for UI changes, and notes on API/DB changes. Ensure `cargo fmt`, `clippy`, and `frontend` lint pass. Do not commit secrets or `.env`.

## Security & Configuration Tips
- Never commit `.env`, `aim.db`, `logs/`, or `target/` (already in `.gitignore`).
- Set `OPENAI_API_KEY` and related vars in `.env`. For the web UI, set `frontend/.env.local` with `NEXT_PUBLIC_API_BASE_URL`.
