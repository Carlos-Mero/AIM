mod agents;
mod aim;
mod sessions;
mod utils;
mod server;
use crate::aim::AIM;
use crate::sessions::ResearchSessionConfig;

use env_logger;
use log::{error};

use clap::Parser;

#[derive(Parser)]
#[command(version, about, arg_required_else_help = true, long_about = None)]
struct Cli {
    /// Explicitly pass the path to the project and start a single sessions to solve this problem
    #[arg(short = 'p', long = "problem")]
    problem: Option<String>,

    /// Proof Model that composes the proofs
    #[arg(short = 'm', long = "proof_model", default_value = "gpt-5")]
    proof_model: String,
    /// Eval Model that evaluates the proofs
    #[arg(long = "eval_model", default_value = "gpt-5")]
    eval_model: String,
    /// Reform Model that does other chores in the workflow
    #[arg(long = "reform_model", default_value = "gpt-5")]
    reform_model: String,

    /// Maximum exploration iterations
    #[arg(short = 's', long = "steps", default_value_t = 24)]
    steps: u32,

    /// parallel reviews in pessimistic verification
    #[arg(short = 'r', long = "reviews", default_value_t = 3)]
    reviews: u8,

    /// Maximum refine iterations
    #[arg(short = 'i', long = "iterations", default_value_t = 4)]
    iterations: u8,

    /// Reasoning effort for API calls (e.g., "low", "medium", "high")
    #[arg(long = "reasoning_effort", default_value = "high")]
    reasoning_effort: String,

    /// Resume from previous memory in a session directory
    #[arg(long = "resume", action = clap::ArgAction::SetTrue, default_value_t = false)]
    resume: bool,

    /// Reformat conjectures and proofs after explorations
    #[arg(long = "reformat", action = clap::ArgAction::SetTrue, default_value_t = false)]
    reformat: bool,

    /// Disable streaming output in each session
    #[arg(long = "no_streaming", action = clap::ArgAction::SetFalse, default_value_t = true)]
    streaming: bool,

    /// Disable theorem graph mode
    #[arg(long = "no_tgm", action = clap::ArgAction::SetFalse, default_value_t = true)]
    theorem_graph_mode: bool,

    /// Running AIM as a server backend
    #[arg(long = "server", action = clap::ArgAction::SetTrue, default_value_t = false)]
    server: bool,
    /// Port to bind in server mode
    #[arg(long = "port", default_value_t = 4000)]
    port: u16
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    use log::LevelFilter;
    // Initialize logger: default to 'info', but in --server mode silence agents & sessions to 'error'
    let env = env_logger::Env::default().default_filter_or("info");
    let mut builder = env_logger::Builder::from_env(env);
    builder.target(env_logger::Target::Stdout);
    if cli.server {
        builder.filter_module("aim::agents", LevelFilter::Error);
        builder.filter_module("aim::sessions", LevelFilter::Error);
    }
    builder.init();

    let mut aim = AIM::new();
    if let Some(p) = cli.problem.as_deref() {
        let config = ResearchSessionConfig::new().logdir(p)
            .proof_model(cli.proof_model)
            .eval_model(cli.eval_model)
            .reform_model(cli.reform_model)
            .steps(cli.steps)
            .reviews(cli.reviews)
            .iterations(cli.iterations)
            .resume(cli.resume)
            .reformat(cli.reformat)
            .streaming(cli.streaming)
            .theorem_graph_mode(cli.theorem_graph_mode)
            .reasoning_effort(cli.reasoning_effort);
        let _ = aim.run_session(config).await;
    } else if cli.server {
        // Bind to all interfaces on the given port
        let bind_addr = format!("0.0.0.0:{}", cli.port);
        log::info!("Starting server at {}", bind_addr);
        aim.runserver(&bind_addr).await?;
    } else {
        error!("Unknown running configs, existing.");
    }

    Ok(())
}
