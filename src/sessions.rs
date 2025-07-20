use std::path::{PathBuf};
use std::fs;
use std::sync::Arc;

use crate::agents::{Agent, Explorer, Reviewer, Refiner, Formatter, MemoryBlock, Memory};
use crate::utils::{extract_component, extract_all_component, find_box, search_bkg_deer_flow};
use indicatif::{ProgressBar, ProgressStyle};
use tokio::task::JoinSet;

use log::{info, warn, debug, error};
use serde::{Serialize, Deserialize};
use sea_orm::{DatabaseConnection, Statement, DbBackend, ConnectionTrait};
use chrono::Utc;

#[async_trait::async_trait]
pub trait Session: Send {
    /// Run locally, persisting to filesystem
    async fn run(&mut self) -> Result<(), Box<dyn std::error::Error>>;
    /// Run remotely, persisting to database
    async fn remote_run(
        &mut self,
        db: &DatabaseConnection,
        user_id: i32,
    ) -> Result<(), Box<dyn std::error::Error>>;
}

const MAX_REVIEWS_PER_NODE: u8 = 24;

#[derive(Default, Debug, Serialize, Deserialize)]
pub struct ResearchSessionConfig {
    title: String,
    logdir: PathBuf,
    proof_model: String,
    eval_model: String,
    reform_model: String,
    steps: u32,
    reviews: u8,
    iterations: u8,
    currect_steps: u32,
    problem: String,
    context: String,
    resume: bool, // resume from existing explore trajectory
    reformat: bool, // reformat conjectures and proofs after exploration
    streaming: bool, // streaming output in exploration
    theorem_graph_mode: bool, // whether to use theorem graph mode
}

impl ResearchSessionConfig {
    pub fn new() -> Self {Self::default()}
    pub fn title(mut self, title: impl Into<String>) -> Self { self.title = title.into(); self }
    pub fn proof_model(mut self, proof_model: impl Into<String>) -> Self {self.proof_model = proof_model.into(); self}
    pub fn eval_model(mut self, eval_model: impl Into<String>) -> Self {self.eval_model = eval_model.into(); self}
    pub fn reform_model(mut self, reform_model: impl Into<String>) -> Self {self.reform_model = reform_model.into(); self}
    pub fn logdir(mut self, logdir: impl Into<String>) -> Self {self.logdir = PathBuf::from(logdir.into()); self}
    pub fn steps(mut self, steps: u32) -> Self {self.steps = steps; self}
    pub fn reviews(mut self, reviews: u8) -> Self {self.reviews = reviews; self}
    pub fn iterations(mut self, iterations: u8) -> Self {self.iterations = iterations; self}
    pub fn resume(mut self, resume: bool) -> Self {self.resume = resume; self}
    pub fn reformat(mut self, reformat: bool) -> Self {self.reformat = reformat; self}
    pub fn streaming(mut self, streaming: bool) -> Self {self.streaming = streaming; self}
    pub fn theorem_graph_mode(mut self, tgm: bool) -> Self {self.theorem_graph_mode = tgm; self}
    pub fn set_current_steps(&mut self, steps: u32) -> &Self {self.currect_steps = steps; self}
    pub fn set_problem(&mut self, problem: impl Into<String>) -> &Self {self.problem = problem.into(); self}
    pub fn set_context(&mut self, context: impl Into<String>) -> &Self {self.context = context.into(); self}

    pub fn save_configs(&self) -> Result<(), Box<dyn std::error::Error>> {
        let serialized_config = serde_json::to_string_pretty(self)?;
        let config_path = self.logdir.as_path().join("config.json");
        fs::write(config_path, serialized_config)?;
        Ok(())
    }
}

pub struct ResearchSession {
    config: ResearchSessionConfig,
    explorer: Explorer,
    reviewer: Reviewer,
    refiner: Refiner,
    memory: Memory,
}

impl ResearchSession {
    pub fn new(config: ResearchSessionConfig) -> Self {
        info!("Initialized a ResearchSession with config: {:#?}", config);
        let explorer = Explorer::new()
            .model(&config.proof_model)
            .streaming(config.streaming);
        let reviewer = Reviewer::new()
            .model(&config.eval_model)
            .reviews(config.reviews)
            .streaming(config.streaming && (config.reviews == 1));
        let refiner = Refiner::new()
            .model(&config.proof_model)
            .streaming(config.streaming);
        let mut mem = Memory::new();
        if !config.context.is_empty() {
            mem.update(MemoryBlock::new()
                .memtype("context")
                .content(&config.context)
                .solved(true)
            );
        }
        ResearchSession {
            config: config,
            explorer: explorer,
            reviewer: reviewer,
            refiner: refiner,
            memory: mem,
        }
    }

    pub async fn load_context(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let context_path = self.config.logdir.as_path().join("context.md");
        if !context_path.exists() {
            info!("No context provided to this problem, searching for related info via deer-flow.");
            let context = search_bkg_deer_flow(&self.config.problem).await?;
            info!("loaded problem context: {:?}", &context);
            self.memory.update(MemoryBlock::new()
                .memtype("context")
                .content(context)
                .solved(true)
            );
            // warn!("Problem context does not exist in session: {:#?}!", &context_path);
            // info!("Running AIM without problem context.");
            return Ok(());
        }
        let context = fs::read_to_string(context_path)?;
        info!("loaded problem context: {:?}", &context);
        self.memory.update(MemoryBlock::new()
            .memtype("context")
            .content(context)
            .solved(true)
        );
        Ok(())
    }

    pub fn resume(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let memory_path = self.config.logdir.as_path().join("memory.json");
        if !memory_path.exists() {
            warn!("History memory does not exist in session: {:#?}!", &memory_path);
            return Ok(());
        }
        let memory_json = fs::read_to_string(memory_path)?;
        let nmemory: Memory = serde_json::from_str(&memory_json)?;
        info!("Resumed Existing Memories: {:#?}", &nmemory);
        self.memory = nmemory;
        Ok(())
    }

    pub async fn review_mems(&mut self, ids: &Vec<usize>) -> Option<Vec<Option<String>>> {
        info!("Start verifying proof path with {} nodes", ids.len());
        let mut tasks: JoinSet<Option<String>> = JoinSet::new();
        let mut res: Vec<Option<String>> = Vec::new();
        for i in ids {
            let mut reviewer = Reviewer::new()
                .model(&self.config.eval_model)
                .reviews(self.config.reviews)
                .streaming(false);
            let memblock = &self.memory.memory[*i];
            let comment = memblock.get_comment().to_string();
            let memtype = memblock.memtype.to_string();
            let num_reviews = memblock.get_reviews();
            if let Some(context) = self.memory.format_deps(*i, false, false) {
                reviewer.set_context(context);
            }
            reviewer.set_conjecture(&memblock.content);
            reviewer.set_proof(&memblock.proof);
            let arc_reviewer = Arc::new(reviewer);
            tasks.spawn(async move {
                if memtype == "context" || num_reviews >= MAX_REVIEWS_PER_NODE {
                    return None;
                }
                if !comment.is_empty() {
                    return Some(comment);
                }
                return arc_reviewer.pverify().await;
            });
        }
        while let Some(task_result) = tasks.join_next().await {
            match task_result {
                Ok(review) => {
                    if let Some(r) = review {
                        res.push(Some(r));
                    } else {
                        res.push(None);
                    }
                },
                Err(e) => {
                    error!("Task failed: {:#?}", e);
                    res.push(None);
                }
            }
        }
        Some(res)
    }

    pub async fn backtrace_review_from(&mut self, id: usize) -> Result<bool, Box<dyn std::error::Error>> {
        // Obtain proof path ids in decreasing order
        let proof_path_ids = self.memory.get_proof_path_ids(id, true);
        info!("Start reviewing the proof path: {:?}", &proof_path_ids);
        let reviews = self.review_mems(&proof_path_ids).await.unwrap_or_default();
        info!("Obtained {} reviews in the proof path", reviews.len());
        // The correctness of this proofpath, default to true and changed to false once a flaw is
        // found in the proof path.
        let mut path_correctness = true;
        // iterate through proof path in the derivation order
        for (i, rev) in proof_path_ids.iter().zip(reviews.iter()) {
            let mem = &mut self.memory.memory[*i];
            if mem.memtype == "context" {
                continue;
            } // eliminate the given context
            mem.set_reviews((mem.get_reviews() + self.config.reviews).min(MAX_REVIEWS_PER_NODE));
            if let Some(r) = rev {
                // Found a flaw in one memblock
                path_correctness = false;
                mem.set_comment(r);
                mem.set_reviews(0);
            }
            mem.set_solved(path_correctness);
            debug!("Modified memblock: {:#?}", &mem);
        }
        Ok(path_correctness)
    }

    pub async fn backtrace_refine_from(&mut self, id: usize) -> Result<(), Box<dyn std::error::Error>> {
        let proof_path_ids = self.memory.get_proof_path_ids(id, true);
        info!("Start refining the proof path: {:?}", &proof_path_ids);
        let mut tasks: JoinSet<(usize, String)> = JoinSet::new();
        for i in proof_path_ids {
            let memblock = &self.memory.memory[i];
            if memblock.is_solved() {
                continue;
            }
            let review = memblock.get_comment();
            if review.is_empty() {
                continue;
            }
            let mut refiner = Refiner::new().model(&self.config.proof_model).streaming(false);
            if let Some(context) = self.memory.format_deps(i, false, false) {
                refiner.set_context(context);
            }
            refiner.set_conjecture(&memblock.content);
            refiner.set_proof(&memblock.proof);
            refiner.set_review(review);
            tasks.spawn(async move {
                // refiner will return a empty string on error
                (i, refiner._process().await.unwrap_or_default())
            });
        }
        while let Some(res) = tasks.join_next().await {
            if let Ok((memid, reproof)) = res {
                let memblock = &mut self.memory.memory[memid];
                info!("One refinement complete for conjecture: {}.", memblock.content);
                if !reproof.is_empty() {
                    memblock.set_comment(String::new());
                    if let Some(judgement) = find_box(&reproof) {
                        if judgement == "false" {
                            if let Some(n_conj) = extract_component(&reproof, "conjecture") {
                                memblock.content = n_conj;
                            }
                        }
                        if let Some(n_proof) = extract_component(&reproof, "proof") {
                            memblock.proof = n_proof;
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn update_memory(&mut self, nmemory: MemoryBlock) {
        if let Ok(mem_str) = serde_json::to_string_pretty(&nmemory) {
            info!("Session Memory Updated with: {}", mem_str);
        }
        self.memory.update(nmemory);
        if let Some(context) = self.memory.format_all(true) {
            self.explorer.set_context(&context);
            self.reviewer.set_context(&context);
            self.refiner.set_context(&context);
        }
    }

    fn update_memory_graph(&mut self, nmemory: MemoryBlock) {
        if let Ok(mem_str) = serde_json::to_string_pretty(&nmemory) {
            info!("Session Memory Graph Updated with: {}", mem_str);
        }
        self.memory.update(nmemory);
    }

    async fn save_memory(&self) -> Result<(), Box<dyn std::error::Error>> {
        let memory_path = self.config.logdir.as_path().join("memory.json");
        let memory_file = fs::File::create(memory_path)?;
        serde_json::to_writer_pretty(memory_file, &self.memory)?;
        Ok(())
    }

    async fn format_memory_to_markdown(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Format all memory contents into standard markdown texts
        info!("reformatting lemma statements");
        let pb = ProgressBar::new(self.memory.memory.len() as u64).with_style(ProgressStyle::with_template(
            "{msg} [{elapsed_precise}] {wide_bar} {pos}/{len} (eta: {eta})"
        )?);
        pb.set_message("Formatting Lemmas");
        let lemma_tasks: Vec<_> = self.memory.memory
            .iter()
            .enumerate()
            .map(|(i, mem)| {
                let formatter = Formatter::new()
                    .model(&self.config.reform_model)
                    .content(&mem.content);
                let pb = pb.clone();
                tokio::task::spawn(async move {
                    let response = formatter._process().await.unwrap();
                    pb.inc(1);
                    (i, response)
                })
            }).collect();
        let results = futures::future::join_all(lemma_tasks).await;
        pb.finish();
        for result in results {
            match result {
                Ok((i, response)) => {
                    if let Some(content) = extract_component(&response, "contents") {
                        self.memory.memory[i].content = content;
                    }
                }
                Err(e) => {
                    error!("Formatting task failed with error: {:?}", e);
                }
            }
        }
        info!("reformatting proofs");
        let pb = ProgressBar::new(self.memory.memory.len() as u64).with_style(ProgressStyle::with_template(
            "{msg} [{elapsed_precise}] {wide_bar} {pos}/{len} (eta: {eta})"
        )?);
        pb.set_message("Formatting Proofs");
        let proof_tasks: Vec<_> = self.memory.memory
            .iter()
            .enumerate()
            .map(|(i, mem)| {
                let formatter = Formatter::new()
                    .model(&self.config.reform_model)
                    .content(&mem.proof);
                let pb = pb.clone();
                tokio::task::spawn(async move {
                    let response = formatter._process().await.unwrap();
                    pb.inc(1);
                    (i, response)
                })
            }).collect();
        let results = futures::future::join_all(proof_tasks).await;
        pb.finish();
        for result in results {
            match result {
                Ok((i, response)) => {
                    if let Some(proof) = extract_component(&response, "contents") {
                        self.memory.memory[i].proof = proof;
                    }
                }
                Err(e) => {
                    error!("Formatting task failed with error: {:?}", e);
                }
            }
        }
        info!("Done formatting all {} memory blocks", self.memory.memory.len());
        Ok(())
    }

    async fn format_to_markdown(&mut self) -> std::io::Result<()> {
        if self.config.reformat {
            let _ = self.format_memory_to_markdown().await;
        }
        let md_path = self.config.logdir.as_path().join("all_memory.md");
        let pp_path = self.config.logdir.as_path().join("proof_path.md");
        if let Some(memory_content) = self.memory.format_all_with_proof(false) {
            info!("Saving memory contents to path: {:#?}", md_path);
            let contents = format!("# Explore Trajectory of AIM\n\n{}", memory_content);
            fs::write(md_path, contents)?;
        }
        if let Some(proof_path_content) = self.memory.format_deps(self.memory.memory.len() - 1, true, true) {
            info!("Saving proof paths to path: {:#?}", pp_path);
            let contents = format!("# Complete Proof Path of AIM\n\n{}", proof_path_content);
            fs::write(pp_path, contents)?;
        }
        Ok(())
    }

    pub async fn graph_step(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        if let Some(context) = self.memory.format_all(true) {
            self.explorer.set_context(&context);
        }
        let raw_exploration = self.explorer._process().await?;
        let conj = extract_component(&raw_exploration, "conjecture").unwrap_or_default();
        let proof = extract_component(&raw_exploration, "proof").unwrap_or_default();
        let final_proof = extract_component(&raw_exploration, "final_proof").unwrap_or_default();
        let deps = extract_component(&raw_exploration, "dependency").unwrap_or_default();
        if (conj.is_empty() || proof.is_empty() || deps.is_empty()) && (final_proof.is_empty() || deps.is_empty()) {
            error!("Incomplete response format: conjecture {}; proof {}; dependency {}; final_proof: {};",
                !conj.is_empty(), !proof.is_empty(), !deps.is_empty(), !final_proof.is_empty());
            return Ok(false);
        }
        if final_proof.is_empty() {
            info!("Collected one new conjecture: {}", &conj);
            self.update_memory_graph(MemoryBlock::new()
                .memtype("lemma")
                .content(&conj)
                .proof(&proof)
                .deps(serde_json::from_str::<Vec<usize>>(&deps).unwrap_or_default())
                .solved(false)
                .reviews(0)
            );
        } else {
            info!("Collected the final proof of this problem.");
            self.update_memory_graph(MemoryBlock::new()
                .memtype("theorem")
                .content(&self.config.problem)
                .proof(&final_proof)
                .deps(serde_json::from_str::<Vec<usize>>(&deps).unwrap_or_default())
                .solved(false)
                .reviews(0)
            );
        }
        let memid = self.memory.memory.len() - 1;
        for i in 0..self.config.iterations+1 {
            info!("Starting the {}-th iteration", i);
            if self.backtrace_review_from(memid).await? {
                info!("backtrace review ended and the proof path is correct.");
                break;
            } else if i < self.config.iterations {
                info!("Some flaws were found in this proof path");
                self.backtrace_refine_from(memid).await?;
            }
        }

        if self.memory.memory[memid].is_solved()
        && self.memory.memory[memid].memtype == "theorem"
        && self.memory.memory[memid].content == self.config.problem {
            return Ok(true);
        }
        return Ok(false);
    }

    pub async fn step(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        // One exploration step of research session.
        // This function retures true if the problem is solved, else it will return false.
        let raw_exploration = self.explorer._process().await?;

        let mut conjectures = extract_all_component(&raw_exploration, "conjecture");
        let mut proofs = extract_all_component(&raw_exploration, "proof");
        let mut depss = extract_all_component(&raw_exploration, "dependency");

        if conjectures.len() != proofs.len() {
            error!(
                "Mismatched number of conjectures ({}) and proofs ({})",
                conjectures.len(),
                proofs.len());
            debug!("Extracted conjectures: {:#?}", &conjectures);
            debug!("Extracted proofs: {:#?}", &proofs);
            return Ok(false);
        } else {
            info!("Successfully collected {} conjectures and proofs in exploration.", conjectures.len());
        }

        for ((conj, proof), deps) in conjectures.iter_mut().zip(proofs.iter_mut()).zip(depss.iter_mut()) {
            info!("Start verifying a conjecture");
            for i in 0..self.config.iterations {
                self.reviewer.set_conjecture(&*conj);
                self.reviewer.set_proof(&*proof);
                let arc_reviewer = Arc::new(self.reviewer.clone());
                if let Some(review) = arc_reviewer.pverify().await {
                    // Directly end this exploration step when one conjecture fails after several
                    // iterations
                    if i == self.config.iterations - 1 {
                        info!("Refinement failed after {} trials.", self.config.iterations);
                        return Ok(false);
                    }
                    info!("A flaw was found in the proof, trying to refine.");
                    self.refiner.set_conjecture(&*conj);
                    self.refiner.set_proof(&*proof);
                    self.refiner.set_review(review);
                    let raw_refinement = self.refiner._process().await?;
                    if let Some(judgement) = find_box(&raw_refinement) {
                        if judgement == "false" {
                            if let Some(n_conj) = extract_component(&raw_refinement, "conjecture") {
                                *conj = n_conj;
                            }
                        }
                        if let Some(n_proof) = extract_component(&raw_refinement, "proof") {
                            *proof = n_proof;
                        }
                    } else {
                        error!("Found a format error in refinement, end this step.");
                        return Ok(false);
                    }
                } else {
                    self.update_memory(MemoryBlock::new()
                        .memtype("lemma")
                        .content(&*conj)
                        .proof(&*proof)
                        .deps(serde_json::from_str::<Vec<usize>>(deps).unwrap_or_default())
                        .solved(true)
                        .reviews(self.config.reviews)
                    );
                    break;
                }
            }
        }

        if let Some(mut final_proof) = extract_component(&raw_exploration, "final_proof") {
            info!("Start verifing the final proof");
            for i in 0..self.config.iterations {
                self.reviewer.set_conjecture(&self.config.problem);
                self.reviewer.set_proof(&final_proof);
                let arc_reviewer = Arc::new(self.reviewer.clone());
                if let Some(review) = arc_reviewer.pverify().await {
                    if i == self.config.iterations - 1 {
                        return Ok(false);
                    }
                    self.refiner.set_conjecture(&self.config.problem);
                    self.refiner.set_proof(&final_proof);
                    self.refiner.set_review(review);
                    let raw_refinement = self.refiner._process().await?;
                    if let Some(n_proof) = extract_component(&raw_refinement, "proof") {
                        final_proof = n_proof;
                    }
                } else {
                    self.update_memory(MemoryBlock::new()
                        .memtype("theorem")
                        .content(&self.config.problem)
                        .proof(&final_proof)
                        .deps(serde_json::from_str::<Vec<usize>>(&depss[depss.len()-1]).unwrap_or_default())
                        .solved(true)
                        .reviews(self.config.reviews)
                    );
                    return Ok(true);
                }
            }
        } else {
            return Ok(false);
        }

        return Ok(false);
    }
}

#[async_trait::async_trait]
impl Session for ResearchSession {
    async fn run(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.config.logdir.exists() {
            panic!("Project path {:?} does not exist!", &self.config.logdir);
        }
        info!("Starting ResearchSession from logdir: {:?}", &self.config.logdir);

        let problem_path = self.config.logdir.as_path().join("problem.md");
        let problem = fs::read_to_string(problem_path)?;
        self.config.set_problem(&problem);
        self.config.save_configs()?;

        info!("Loaded problem: {:?}", &problem);
        self.explorer.set_problem(problem);

        if self.config.resume {
            info!("Resuming from previous explorations");
            self.resume()?;
            // If a theorem is already found in memory, aim will not continue exploring.
            for mem in &self.memory.memory {
                if mem.memtype == "theorem" {
                    info!("A final theorem already exists in history memory.");
                    info!("Start reformatting memory and canceling exploration.");
                    self.format_to_markdown().await?;
                    return Ok(());
                }
            }
        } else {
            self.load_context().await?;
        }

        let pb = ProgressBar::new(self.config.steps.into()).with_style(ProgressStyle::with_template(
            "{msg} [{elapsed_precise}] {wide_bar} {pos}/{len} (eta: {eta})"
        )?);
        pb.set_message("Exploring");
        for i in 0..self.config.steps {
            info!("Starting Exploration Step: {}", i);
            self.config.set_current_steps(i);
            let solved = if self.config.theorem_graph_mode {
                self.graph_step().await?
            } else {
                self.step().await?
            };
            self.save_memory().await?;
            pb.inc(1);
            if solved {break;}
        }
        self.format_to_markdown().await?;

        Ok(())
    }
    /// Run session remotely: same workflow as `run`, but persist results in SQLite
    async fn remote_run(
        &mut self,
        db: &DatabaseConnection,
        user_id: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Set up problem and initial context/memory
        self.explorer.set_problem(self.config.problem.clone());
        // Prepare timestamp and initial record
        let ts = Utc::now().to_rfc3339().replace("'", "''");
        let cfg_json = serde_json::to_string(&self.config)?;
        let init_mem = serde_json::to_string(&self.memory)?;
        let mut ctx = self.memory.memory.iter()
            .find(|m| m.memtype == "context")
            .map(|m| m.content.clone()).unwrap_or_default();
        if ctx.is_empty() {
            // If there is no context information in this session,
            // we will start a new deer-flow process to obtain required bkg
            ctx = search_bkg_deer_flow(&self.config.problem).await?;
            self.update_memory_graph(MemoryBlock::new()
                .memtype("context")
                .content(&ctx)
                .solved(true)
            );
        }
        let title = self.config.title.replace("'", "''");
        // initial lemma count from memory blocks
        let init_lemmas = self.memory.memory.iter().filter(|m| m.memtype == "lemma").count() as i32;
        let insert_sql = format!(
            "INSERT INTO projects (user_id, title, problem, context, config, memory, created_at, last_active, lemmas_count, status) VALUES ({}, '{}', '{}', '{}', '{}', '{}', '{}', '{}', {}, 'running')",
            user_id,
            title,
            self.config.problem.replace("'", "''"),
            ctx.replace("'", "''"),
            cfg_json.replace("'", "''"),
            init_mem.replace("'", "''"),
            ts,
            ts,
            init_lemmas,
        );
        db.execute(Statement::from_string(DbBackend::Sqlite, insert_sql)).await?;
        // Exploration loop: update memory after each step
        let mut solved_flag = false;
        for _ in 0..self.config.steps {
            let done = if self.config.theorem_graph_mode {
                self.graph_step().await?
            } else {
                self.step().await?
            };
            // update memory, last_active and lemma count
            let mem_json = serde_json::to_string(&self.memory.memory)?;
            let now = Utc::now().to_rfc3339().replace("'", "''");
            let lemmas = self.memory.memory.iter().filter(|m| m.memtype == "lemma").count() as i32;
            let upd_sql = format!(
                "UPDATE projects SET memory='{}', last_active='{}', lemmas_count={} WHERE user_id={} AND created_at='{}'",
                mem_json.replace("'", "''"),
                now,
                lemmas,
                user_id,
                ts,
            );
        db.execute(Statement::from_string(DbBackend::Sqlite, upd_sql)).await?;
            if done {
                solved_flag = true;
                break;
            }
        }
        // After exploration loop, update final status: solved if a theorem was found, else ended
        let status = if solved_flag { "solved" } else { "ended" };
        let status_sql = format!(
            "UPDATE projects SET status='{}' WHERE user_id={} AND created_at='{}'",
            status, user_id, ts
        );
        db.execute(Statement::from_string(DbBackend::Sqlite, status_sql)).await?;
        Ok(())
    }
}
