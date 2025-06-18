use std::path::{PathBuf};
use std::fs;
use std::sync::Arc;

use crate::agents::{Agent, Explorer, Reviewer, Refiner, Formatter, MemoryBlock, Memory};
use crate::utils::{extract_component, extract_all_component, find_box};
use indicatif::{ProgressBar, ProgressStyle};

use log::{info, warn, debug, error};
use serde::{Serialize, Deserialize};

#[async_trait::async_trait]
pub trait Session: Send {
    async fn run(&mut self) -> Result<(), Box<dyn std::error::Error>>;
}

#[derive(Default, Serialize, Deserialize)]
pub struct ResearchSessionConfig {
    logdir: PathBuf,
    proof_model: String,
    eval_model: String,
    reform_model: String,
    steps: u32,
    reviews: u8,
    iterations: u8,
    currect_steps: u32,
    problem: String,
    resume: bool, // resume from existing explore trajectory
    reformat: bool, // reformat conjectures and proofs after exploration
    streaming: bool, // streaming output in exploration
}

impl ResearchSessionConfig {
    pub fn new() -> Self {Self::default()}
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
    pub fn set_current_steps(&mut self, steps: u32) -> &Self {self.currect_steps = steps; self}
    pub fn set_problem(&mut self, problem: impl Into<String>) -> &Self {self.problem = problem.into(); self}

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
        info!("Initialized a ResearchSession with config: {:#?}", serde_json::to_string(&config).unwrap());
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
        ResearchSession {
            config: config,
            explorer: explorer,
            reviewer: reviewer,
            refiner: refiner,
            memory: Memory::new(),
        }
    }

    pub fn load_context(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let context_path = self.config.logdir.as_path().join("context.md");
        if !context_path.exists() {
            warn!("Problem context does not exist in session: {:#?}!", &context_path);
            info!("Running AIM without problem context.");
            return Ok(());
        }
        let context = fs::read_to_string(context_path)?;
        info!("loaded problem context: {:?}", &context);
        self.memory.update(MemoryBlock::new()
            .memtype("context")
            .content(context)
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

    fn update_memory(&mut self, nmemory: MemoryBlock) {
        if let Ok(mem_str) = serde_json::to_string_pretty(&nmemory) {
            info!("Session Memory Updated with: {}", mem_str);
        }
        self.memory.update(nmemory);
        if let Some(context) = self.memory.format_all() {
            self.explorer.set_context(&context);
            self.reviewer.set_context(&context);
            self.refiner.set_context(&context);
        }
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
        if let Some(memory_content) = self.memory.format_all_with_proof() {
            info!("Saving memory contents to path: {:#?}", md_path);
            let contents = format!("# Explore Trajectory of AIM\n\n{}", memory_content);
            fs::write(md_path, contents)?;
        }
        if let Some(proof_path_content) = self.memory.format_deps(self.memory.memory.len() - 1, true) {
            info!("Saving proof paths to path: {:#?}", pp_path);
            let contents = format!("# Complete Proof Path of AIM\n\n{}", proof_path_content);
            fs::write(pp_path, contents)?;
        }
        Ok(())
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
            self.load_context()?;
        }

        let pb = ProgressBar::new(self.config.steps.into()).with_style(ProgressStyle::with_template(
            "{msg} [{elapsed_precise}] {wide_bar} {pos}/{len} (eta: {eta})"
        )?);
        pb.set_message("Exploring");
        for i in 0..self.config.steps {
            info!("Starting Exploration Step: {}", i);
            self.config.set_current_steps(i);
            let solved = self.step().await?;
            self.save_memory().await?;
            pb.inc(1);
            if solved {break;}
        }
        self.format_to_markdown().await?;

        Ok(())
    }
}
