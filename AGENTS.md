# Repository Guidelines

## Project Structure & Module Organization
Core Rust logic lives under `src/`: `main.rs` bootstraps the CLI/server, `aim.rs` orchestrates sessions, `agents.rs` defines reasoning pipelines, and `src/server` exposes the Actix + SeaORM HTTP stack. SQLite state persists in `aim.db`, with per-run traces stored under `logs/`. The Next.js UI is contained in `frontend/` (`src/` for routes/components, `public/` assets), while optional research tooling sits in `deer-flow/`.

## Build, Test, and Development Commands
- `cargo build --release`: Compile the binary to `target/release/aim`.
- `cargo run -- --server`: Start the API (serves `frontend/out` when present).
- `cargo install --path .`: Install `aim` into your local toolchain.
- `npm install && npm run dev` inside `frontend/`: Dev server against `http://localhost:4000`.
- `npm run build && npm run start`: Produce and serve the production bundle.
- `uv run main.py` within `deer-flow/`: Run the optional literature workflow.

## Coding Style & Naming Conventions
Rust code targets edition 2024: four-space indentation, snake_case functions/modules, UpperCamelCase types. Always run `cargo fmt` plus `cargo clippy --all-targets --all-features`; treat clippy warnings as blockers. Frontend code should satisfy `npm run lint`, keep React components in PascalCase files, prefer hooks-based state, and reserve kebab-case for route folders. Secrets (`.env`, `.webui_secret_key`, SQLite files) must stay out of version control.

## Testing Guidelines
Coverage is light, so each new Rust module should include focused unit tests run via `cargo test` (target modules with `cargo test sessions::tests::resume_state` when iterating). Mock external APIs instead of exercising real keys. Frontend work must pass `npm run lint`; add React Testing Library or Cypress coverage for interactive views and keep fixtures under `frontend/__tests__/`. Document one-off scripts in the PR to keep reviewers aligned.

## Commit & Pull Request Guidelines
Stick to the Conventional Commit prefixes already in history (`feat:`, `fix:`, `docs:`, `chore:`). PR descriptions should state the motivation, enumerate changes, include command outputs (`cargo test`, `npm run build`, etc.), and attach screenshots or terminal snippets for UI/CLI changes. Link issues with `Closes #123` and request review only after formatter, linter, and build commands succeed locally.

## Security & Configuration Tips
Create `.env` manually (there is no example file) with `OPENAI_API_KEY`, optional `AIM_ADMIN_EMAIL`, and invite codes, and keep it untracked. Scope `aim.db` to the project folder so `--resume` only touches the intended session, and set `NEXT_PUBLIC_API_BASE_URL` before serving the frontend through a TLS-terminating proxy or gateway.
