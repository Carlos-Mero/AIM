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

To be implemented.
