# AIM

AI Mathehatician (Working In Process)

AIM is an agentic system targed at frontier mathematical research. This version of AIM is equipped with a multistep explore mechanism and a self-verification mechanism. It can further leverage the strong capability of large reasoning models, and provide valuable assistance for human mathematicians. Note that AIM is specifically designed for complex research-level problems, and is not suitable for exercises

## Usage

Currently you can run AIM at your local machine with the following steps.

#### Obtain AIM Executable

This implementation of AIM is written in Rust language for better performance. You can directly download the executable in release page of this repo (if exists). Otherwise you'll need to build AIM by your self. Firstly make sure you have correctly setup the Rust toolchain on your local machine, after that you can compile AIM with the following commands:

```sh
git clone https://github.com/Carlos-Mero/AIM.git
cd AIM
cargo build --release
```

In this way you can find the standalone executable at path `./target/release/aim`. You can also use the following command to compile and install aim at your system path, so that you can use it more conveniently.

```sh
cargo install --path .
```

#### Setup API Configs

AIM uses `dotenv` to configure API-keys for this agentic system. You need to create a file named `.env` at the project path or the parent path of that you want to run `aim`. Its contents should be as follows:

```txt
OPENAI_API_KEY=sk-xxxxxx
# Optional
OPENAI_API_BASEURL=https://api.openai.com
# Role & Invitation Codes (optional)
# Specify an admin account that bypasses project limits:
AIM_ADMIN_EMAIL=admin@example.com
# Specify the invitation code for "invited" users (max 3 new projects per day):
AIM_INV_CODE=your-invite-code
```

After this you will be able to run `aim` in your project without environment errors.

#### Project Setup

Currently `aim` only supports locally running one session in each process. A project (or session) for AIM is a directory containing the target problem and relevant context of it. This directory should contain a file named `problem.md` which contains the target problem, and an optional file named `context.md` to provide background information of this problem if needed. More accurately, one project structure may look like follows:

```txt
 project
├──  .env
├──  context.md
└──  problem.md
```

Both the problem and context should be written in markdown format with LaTeX extension. It is better not to use headers in both files. After you have correctly setup and entered this project directory, you can start default `aim` pipeline with the following command:

```sh
aim -p .
```

You can also resume from an existing unsolved project by additionally passing `--resume` as a argument. You can run `aim --help` to obtain the usage of other commandline arguments.

#### Interactive Mode & Server Mode

AIM supports both a single-session CLI workflow and a long-running server mode for integration with a web frontend.

1. Server Mode
   ```sh
   aim --server
   ```
   Starts an HTTP API on port 4000 by default. Endpoints allow you to submit problems, stream progress, and fetch results.

2. Web Frontend
   A Next.js frontend is provided under `./frontend`. To launch:
   ```sh
   cd frontend
   npm install
   echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:4000" > .env.local
   npm run dev
   ```
   Open http://localhost:3000 to start new sessions, visualize theorem graphs, explore proofs, and view logs. You can also run `npm run build` under the frontend folder. This will build up static frontend files of this project. The `aim` executable already equipped with static file serving capability. Then you can directly visiting localhost:4000 when `aim --server` is running.

### Command-Line Options
Run `aim --help` for full details. Common flags include:
```text
  -p, --problem <PATH>        path to project dir containing problem.md
  -m, --proof_model <NAME>    LLM for composing proofs (default: deepseek-r1)
      --eval_model <NAME>     LLM for verifying proofs (default: deepseek-r1)
      --reform_model <NAME>   LLM for refining proofs (default: deepseek-r1)
  -s, --steps <N>             max exploration iterations (default: 24)
  -r, --reviews <N>           parallel reviews count (default: 3)
  -i, --iterations <N>        max refine iterations (default: 4)
      --resume                resume from existing session
      --reformat              reformat conjectures & proofs after exploration
      --no_streaming          disable streaming output
      --no_tgm                disable theorem-graph visualization
      --server                run as long-running backend
```

### Session Persistence & Logs
- Intermediate state and memory are stored in `aim.db` in your project folder—use `--resume` to continue an interrupted run.
- Step-by-step logs are written under `logs/` within the session directory.

### Contributing
Contributions are welcome! Please open issues or pull requests on GitHub.
