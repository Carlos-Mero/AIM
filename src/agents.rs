use futures_util::StreamExt;
use log::{debug, error, info, warn};
use serde_json::json;
use tokio::task::JoinSet;

use crate::utils::find_box;
use dotenvy::dotenv;
use indicatif::{ProgressBar, ProgressStyle};
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use std::time::Duration;

// const CONNECT_TIMEOUT: Duration = Duration::from_secs(6000);
// const REQUEST_TIMEOUT: Duration = Duration::from_secs(18000);
const API_RETRY_DELAY: Duration = Duration::from_secs(2);
const MAX_REQWEST_RETRIES: u8 = 7;
const MAX_CHUNK_DECODE_RETRIES: u8 = 16;

use chrono::{DateTime, Utc};

/// Provide default timestamp when deserializing older memory entries
pub fn default_datetime() -> DateTime<Utc> {
    Utc::now()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryBlock {
    pub memtype: String,
    pub content: String,
    pub proof: String,
    pub proof_summary: String,
    /// Timestamp when this memory block was created
    #[serde(default = "default_datetime")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when this memory block was last modified
    #[serde(default = "default_datetime")]
    pub updated_at: DateTime<Utc>,
    // Used in memory graph, working in process
    solved: bool,
    reviews: u8,
    comment: String,
    deps: Vec<usize>,
}

impl MemoryBlock {
    /// Create a new MemoryBlock with timestamps set to now
    pub fn new() -> Self {
        let now = Utc::now();
        MemoryBlock {
            memtype: String::new(),
            content: String::new(),
            proof: String::new(),
            proof_summary: String::new(),
            created_at: now,
            updated_at: now,
            solved: false,
            reviews: 0,
            comment: String::new(),
            deps: Vec::new(),
        }
    }
    pub fn memtype(mut self, memtype: impl Into<String>) -> Self {
        self.memtype = memtype.into();
        self.updated_at = Utc::now();
        self
    }
    pub fn content(mut self, content: impl Into<String>) -> Self {
        self.content = content.into();
        self.updated_at = Utc::now();
        self
    }
    pub fn proof(mut self, proof: impl Into<String>) -> Self {
        self.proof = proof.into();
        self.updated_at = Utc::now();
        self
    }
    pub fn set_proof_summary(&mut self, proof_summary: impl Into<String>) -> &Self {
        self.proof_summary = proof_summary.into();
        self.updated_at = Utc::now();
        self
    }
    pub fn solved(mut self, solved: bool) -> Self {
        self.solved = solved;
        self.updated_at = Utc::now();
        self
    }
    pub fn reviews(mut self, reviews: u8) -> Self {
        self.reviews = reviews;
        self.updated_at = Utc::now();
        self
    }
    pub fn deps(mut self, deps: Vec<usize>) -> Self {
        self.deps = deps;
        self.updated_at = Utc::now();
        self
    }
    pub fn is_solved(&self) -> bool {
        self.solved
    }
    pub fn set_solved(&mut self, solved: bool) -> &Self {
        self.solved = solved;
        self.updated_at = Utc::now();
        self
    }
    pub fn get_reviews(&self) -> u8 {
        self.reviews
    }
    pub fn set_reviews(&mut self, reviews: u8) -> &Self {
        self.reviews = reviews;
        self.updated_at = Utc::now();
        self
    }
    pub fn get_comment(&self) -> &str {
        &self.comment
    }
    pub fn set_comment(&mut self, comment: impl Into<String>) -> &Self {
        self.comment = comment.into();
        self.updated_at = Utc::now();
        self
    }

    pub fn _format(&self) -> String {
        format!(
            "\\begin{{{0}}}\n{1}\n\n**DEPENDENCY**: {2:?}\n\\end{{{0}}}",
            &self.memtype, &self.content, &self.deps
        )
    }
    pub fn _format_with_proof(&self) -> String {
        let proof_content = if self.proof.is_empty() {
            String::new()
        } else {
            format!("\n\\begin{{proof}}\n{0}\n\\end{{proof}}", &self.proof)
        };
        format!(
            "\\begin{{{0}}}\n{1}\n\n**DEPENDENCY**: {2:?}\n\\end{{{0}}}{3}",
            &self.memtype, &self.content, &self.deps, &proof_content
        )
    }

    pub fn _format_with_proof_summary(&self) -> String {
        let ps_content = if self.proof_summary.is_empty() {
            String::new()
        } else {
            format!(
                "\n<proof_summary>\n{}\n</proof_summary>",
                &self.proof_summary
            )
        };
        format!(
            "\\begin{{{0}}}\n{1}\n\n**DEPENDENCY**: {2:?}\n\\end{{{0}}}\n\n**Proof Sketch**{3}",
            &self.memtype, &self.content, &self.deps, &ps_content
        )
    }
}

#[derive(Default, Debug, Serialize, Deserialize)]
pub struct Memory {
    pub memory: Vec<MemoryBlock>,
}

impl Memory {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn update(&mut self, nmemory: MemoryBlock) {
        self.memory.push(nmemory);
    }
    pub fn get_proof_path_ids(&self, id: usize, include_end_node: bool) -> Vec<usize> {
        // Format the given memory ID and all dependencies of it
        // ids are sorted in the increasing order
        let mut dep_ids: Vec<usize> = vec![id];
        let mut retrieve_id: usize = 0;

        while let Some(memblock) = &self.memory.get(dep_ids[retrieve_id]) {
            for id in &memblock.deps {
                if !dep_ids.contains(id) {
                    dep_ids.push(*id);
                }
            }

            retrieve_id += 1;
            if retrieve_id >= dep_ids.len() {
                break;
            }
        }
        if !include_end_node {
            dep_ids.remove(0);
        }

        // add the context information in memory id: 0 if exists
        if let Some(memblock) = &self.memory.get(0) {
            if !dep_ids.contains(&0) && memblock.memtype == "context" {
                dep_ids.push(0);
            }
        }

        dep_ids.sort_unstable();
        return dep_ids;
    }

    //    pub fn get_subgraph_ids(&self, id: usize) -> Vec<usize> {
    //        // Get all the memory ids derived from the given id
    //        let mut dev_ids: Vec<usize> = vec![id];
    //        for i in id+1 .. self.memory.len() {
    //            let memblock = &self.memory[i];
    //            for dep_id in &memblock.deps {
    //                if dev_ids.contains(dep_id) && !dev_ids.contains(&i) {
    //                    dev_ids.push(i);
    //                    break;
    //                }
    //            }
    //        }
    //        return dev_ids;
    //    }

    pub fn format_deps(
        &self,
        id: usize,
        with_proof: bool,
        include_end_node: bool,
    ) -> Option<String> {
        let mut dep_ids = self.get_proof_path_ids(id, include_end_node);
        let mut res = String::new();
        // add the context information in memory id: 0 if exists
        if let Some(memblock) = &self.memory.get(0) {
            if !dep_ids.contains(&0) && memblock.memtype == "context" {
                dep_ids.push(0);
            }
        }

        for id in dep_ids.iter().rev() {
            if let Some(memblock) = &self.memory.get(*id) {
                res.push_str(&format!(
                    "#### Memory **ID: {}**\n\n{}\n\n",
                    id,
                    if with_proof {
                        memblock._format_with_proof()
                    } else {
                        memblock._format()
                    }
                ));
            }
        }

        if res.is_empty() { None } else { Some(res) }
    }
    // pub fn format_all(&self, solved_only: bool) -> Option<String> {
    //     // Format all memory blocks as the input of other agents
    //     if self.memory.is_empty() {
    //         None
    //     } else {
    //         Some(
    //             self.memory
    //                 .iter()
    //                 .enumerate()
    //                 .filter(|(_, mem)| if solved_only {mem.is_solved()} else {true})
    //                 .map(|(i, mem)| format!("#### Memory **ID: {i}**\n\n{}\n\n", mem._format()))
    //                 .collect::<String>(),
    //         )
    //     }
    // }
    pub fn format_all_with_proof(&self, solved_only: bool) -> Option<String> {
        // Format all memory blocks with proofs as the final output
        if self.memory.is_empty() {
            None
        } else {
            Some(
                self.memory
                    .iter()
                    .enumerate()
                    .filter(|(_, mem)| if solved_only { mem.is_solved() } else { true })
                    .map(|(i, mem)| {
                        format!(
                            "#### Memory **ID: {i}**\n\n{}\n\n",
                            mem._format_with_proof()
                        )
                    })
                    .collect::<String>(),
            )
        }
    }

    pub fn format_all_with_proof_summary(&self, solved_only: bool) -> Option<String> {
        // Format all memory blocks with proofs and proof summaries as the final output
        if self.memory.is_empty() {
            None
        } else {
            Some(
                self.memory
                    .iter()
                    .enumerate()
                    .filter(|(_, mem)| if solved_only { mem.is_solved() } else { true })
                    .map(|(i, mem)| {
                        format!(
                            "#### Memory **ID: {i}**\n\n{}\n\n",
                            mem._format_with_proof_summary()
                        )
                    })
                    .collect::<String>(),
            )
        }
    }
}

#[derive(Clone)]
pub struct LMClient {
    client: reqwest::Client,
    api_key: String,
    base_url: String,
}

impl LMClient {
    pub fn new() -> Self {
        if let Err(e) = dotenv() {
            error!("Error occured when loading .env file: {}", e);
            panic!();
        }
        let api_key = match env::var("OPENAI_API_KEY") {
            Ok(key) => key,
            Err(e) => {
                error!("Error: {}.\nPlease specify your API key in .env file.", e);
                panic!();
            }
        };
        let base_url =
            env::var("OPENAI_API_BASEURL").unwrap_or_else(|_| "https://api.openai.com".into());

        let client = reqwest::Client::builder()
            // .connect_timeout(CONNECT_TIMEOUT)
            // .timeout(REQUEST_TIMEOUT)
            .build()
            .unwrap();
        LMClient {
            client: client,
            api_key: api_key,
            base_url: base_url.into(),
        }
    }

    async fn comp(
        &self,
        prompt: &str,
        model: &str,
        stream_output: bool,
        reasoning_effort: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Always send stream=true since SSE client expects event stream
        // Always include reasoning_effort; non-supporting models ignore it.
        let request_body = json!({
            "model": model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 1.0,
            "stream": true,
            "reasoning_effort": reasoning_effort
        });
        let url = format!(
            "{}/v1/chat/completions",
            &self.base_url.trim_end_matches('/').trim_end_matches("/v1")
        );

        let mut attempt: u8 = 0;

        loop {
            debug!(
                "Sending request to url {}, Attempt {}:\n{:#?}",
                &url, attempt, &request_body
            );
            attempt += 1;

            let response = self
                .client
                .post(&url)
                .bearer_auth(&self.api_key)
                .header(reqwest::header::ACCEPT, "text/event-stream")
                .json(&request_body)
                .send()
                .await;

            match response {
                Ok(resp) if resp.status().is_success() => {
                    let mut stream = resp.bytes_stream();
                    let mut content_buffer = String::new();
                    let mut sse_buffer = String::new();
                    let mut chunk_decode_retries: u8 = 0;

                    while let Some(chunk) = stream.next().await {
                        let chunk = match chunk {
                            Ok(content) => content,
                            Err(e) => {
                                chunk_decode_retries += 1;
                                error!("Error occured when parsing a chunk: {:#?}", e);
                                if chunk_decode_retries > MAX_CHUNK_DECODE_RETRIES {
                                    return Err(Box::new(e));
                                } else {
                                    continue;
                                }
                            }
                        };
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        sse_buffer.push_str(&chunk_str);

                        while let Some(newline_pos) = sse_buffer.find('\n') {
                            let line = sse_buffer.drain(..=newline_pos).collect::<String>();
                            let line = line.trim_end_matches('\n').trim_end_matches('\r');
                            if line.starts_with("data:") {
                                let data_str = line.trim_start_matches("data:").trim();

                                if data_str == "[DONE]" {
                                    continue;
                                }

                                match serde_json::from_str::<serde_json::Value>(data_str) {
                                    Ok(data) => {
                                        if let Some(content) =
                                            data["choices"][0]["delta"]["reasoning_content"]
                                                .as_str()
                                        {
                                            if stream_output {
                                                print!("{}", &content)
                                            }
                                        }
                                        if let Some(content) =
                                            data["choices"][0]["delta"]["content"].as_str()
                                        {
                                            if stream_output {
                                                print!("{}", &content)
                                            }
                                            content_buffer.push_str(content);
                                        }
                                    }
                                    Err(e) => {
                                        debug!("JSON parse error: {} in data: {}", e, data_str);
                                    }
                                }
                            }
                        }
                    }

                    if !sse_buffer.is_empty() {
                        warn!("Remaining unprocessed data: {}", sse_buffer);
                    }

                    return Ok(content_buffer);
                }
                Ok(res) => {
                    warn!("Error occured when calling API, status: {}", res.status());
                    if attempt > MAX_REQWEST_RETRIES {
                        return Err(format!("API call failed after all {} retries", attempt).into());
                    }
                    tokio::time::sleep(API_RETRY_DELAY).await;
                }
                Err(e) => {
                    warn!("Error occured when decoding response with error: {}", e);
                    if attempt > MAX_REQWEST_RETRIES {
                        return Err(e.into());
                    }
                    tokio::time::sleep(API_RETRY_DELAY).await;
                }
            }
        }
    }
}

#[async_trait::async_trait]
pub trait Agent: Send {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>>;
}

pub struct Explorer {
    client: LMClient,
    model: String,
    problem: String,
    streaming: bool,
    context: Option<String>,
    reasoning_effort: String,
}

impl Explorer {
    pub fn new() -> Self {
        Explorer {
            client: LMClient::new(),
            model: String::new(),
            problem: String::new(),
            streaming: false,
            context: None,
            reasoning_effort: "medium".into(),
        }
    }
    pub fn model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }
    pub fn streaming(mut self, streaming: bool) -> Self {
        self.streaming = streaming;
        self
    }
    pub fn set_problem(&mut self, problem: impl Into<String>) -> &Self {
        self.problem = problem.into();
        self
    }
    pub fn set_context(&mut self, context: impl Into<String>) -> &Self {
        self.context = Some(context.into());
        self
    }
    pub fn reasoning_effort(mut self, effort: impl Into<String>) -> Self {
        self.reasoning_effort = effort.into();
        self
    }
}

#[async_trait::async_trait]
impl Agent for Explorer {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let problem_stat = format!("\\begin{{problem}}{}\\end{{problem}}", &self.problem);
        let mut context_prefix = String::new();
        if let Some(context) = &self.context {
            context_prefix = format!(
                "\n\nHere is a list of context that we have collected for this problem or our history findings during exploration. They can be accepted without controversy as correct, and you can begin your exploration based on them.\n\n### Context and History Explorations\n\n{}",
                context
            );
        }
        let prompt = (concat!(
            "### Instruction\n",
            "\n",
            "You are an expert that is knowledgeable across all domains in math. This time you are asked to help with our frontier math research. Its statement is as follows:\n",
            "\n"
        )
        .to_string()
            + &problem_stat
            + concat!(
                "\n",
                "This problem could be difficult and not able to be directly solved, but you can make your contribution with the following instructions:\n",
                "\n",
                "1. You are required to explore different approaches or directions that might help with our final goal, and write down one interesting finding in your explorations as a new conjecture in your response. DO NOT claim that you can not do this job.\n",
                "2. Your conjecture must contain the complete definitions required within it, such that it is able to stand alone as an independent lemma, unless it is declared in memory. It should be a novel conjecture that marks concrete achievements and is not similar to any existing lemmas.\n",
                "3. You should wrap your finding inside a latex environment: \\begin{conjecture}\\end{conjecture}. This conjecture should be equipped with a detailed, complete and rigorous proof. You should explicitly write down every intermediate derivation step in the proof. The corresponding proof should be wrapped in \\begin{proof}\\end{proof} directly followed by the conjecture.\n",
                "4. After these components you should also provide the dependency of this conjecture. You need to write down the memory IDs of lemmas used in this conjecture in a JSON array format, and warp them inside \\begin{dependency}\\end{dependency}. For example, a dependency of a new conjecture could be \\begin{dependency}[0, 3, 4]\\end{dependency}. You can use an empty array \"[]\" when this conjecture does not depend on other lemmas.\n",
                "\n",
                "More accurately, your response should obey the following format:\n",
                "\n",
                "\\begin{conjecture}Your new findings here\\end{conjecture}\n",
                "\\begin{proof}Your proof of the conjecture above\\end{proof}\n",
                "\\begin{dependency}An json array of related memory IDs of this conjecture\\end{dependency}",
                "\n",
                "Moreover, when you think the time is right that you are able to prove the original problem, you can simply state your proof inside \\begin{final_proof}\\end{final_proof}, and explicitly write down its dependency in \\begin{dependency}\\end{dependency}. In this case, you do not need to propose any new conjectures for this problem."
            ))
            + &context_prefix;

        return self
            .client
            .comp(&prompt, &self.model, self.streaming, &self.reasoning_effort)
            .await;
    }
}

#[derive(Clone)]
pub struct Reviewer {
    client: LMClient,
    model: String,
    conjecture: String,
    proof: String,
    reviews: u8,
    streaming: bool,
    context: Option<String>,
    reasoning_effort: String,
}

impl Reviewer {
    pub fn new() -> Self {
        Reviewer {
            client: LMClient::new(),
            model: String::new(),
            conjecture: String::new(),
            proof: String::new(),
            reviews: 0,
            streaming: false,
            context: None,
            reasoning_effort: "medium".into(),
        }
    }
    pub fn model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }
    pub fn reviews(mut self, reviews: u8) -> Self {
        self.reviews = reviews;
        self
    }
    pub fn streaming(mut self, streaming: bool) -> Self {
        self.streaming = streaming;
        self
    }
    pub fn set_conjecture(&mut self, conjecture: impl Into<String>) -> &Self {
        self.conjecture = conjecture.into();
        self
    }
    pub fn set_proof(&mut self, proof: impl Into<String>) -> &Self {
        self.proof = proof.into();
        self
    }
    pub fn set_context(&mut self, context: impl Into<String>) -> &Self {
        self.context = Some(context.into());
        self
    }
    pub fn reasoning_effort(mut self, effort: impl Into<String>) -> Self {
        self.reasoning_effort = effort.into();
        self
    }

    pub async fn pverify(self: Arc<Self>) -> Option<String> {
        // pessimistic verification for the given conjecture and proof
        // it will return a string of reviews if some flaws are found in the proof or conjecture
        // or else it will return None when no problem is found
        info!("Starting pverify with **{}** reviewers.", self.reviews);
        let pb = ProgressBar::new(self.reviews as u64);
        if let Ok(style) = ProgressStyle::with_template(
            "{msg} [{elapsed_precise}] {wide_bar} {pos}/{len} (eta: {eta})",
        ) {
            pb.set_style(style);
        } else {
            warn!("Incorrect style template for progressbar.");
        }
        pb.set_message("pverifying");

        let mut tasks: JoinSet<Option<String>> = JoinSet::new();
        for _ in 0..self.reviews {
            let n_reviewer = self.clone();
            let n_pb = pb.clone();
            tasks.spawn(async move {
                let res = match n_reviewer._process().await {
                    Ok(s) => Some(s),
                    Err(e) => {
                        error!("Error Occured when reviewing: {}", e);
                        None
                    }
                };
                n_pb.inc(1);
                res
            });
        }

        while let Ok(review) = tasks.join_next().await? {
            if let Some(r) = review {
                debug!("Collected one review: {}", &r);
                if find_box(&r)? == "invalid" {
                    info!("One reviewer found a flaw in the proof: {}", &r);
                    tasks.shutdown().await;
                    pb.finish();
                    return Some(r);
                }
            }
        }
        pb.finish();
        return None;
    }
}

#[async_trait::async_trait]
impl Agent for Reviewer {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let conjecture_proof = format!(
            "### Conjecture\n\n{}\n\n### Proof\n\n{}",
            &self.conjecture, &self.proof
        );
        let mut context_prefix = String::new();
        if let Some(context) = &self.context {
            context_prefix = format!(
                "\n\n### Context and History Explorations\n\nHere is a list of context that we have collected for this problem or our history findings during exploration. They serve as the background of the conjecture and proof and can be accepted without controversy as correct.\n\n{}",
                context
            );
        }
        let prompt = concat!(
             "### Instruction\n",
             "\n",
             "You are an expert that is knowledgeable across all domains in math. Here you will be given a conjecture and a corresponding proof in math. You need to act as a reviewer of this proof, carefully examine and verify this proof.\n",
             "\n",
             "A valid proof must satisfy the following three conditions:\n",
             "\n",
             "1. **Correct**. There is no logical errors or calculation errors in the proof, and every theorems applied in the proof must accurately satisfy the required conditions.\n",
             "2. **Complete**. The proof should contain every detailed intermediate steps in derivations or calculations.\n",
             "3. **Rigorous**. Every statement in the proof must either come from detailed proofsteps or preliminaries or lemmas.\n",
             "\n",
             "Please state your verification result inside $\\boxed{}$ as $\\boxed{valid}$ or $\\boxed{invalid}$. You also need to include the rationale on your decision in your response.\n",
             "\n").to_string() + &conjecture_proof + &context_prefix;
        return self
            .client
            .comp(&prompt, &self.model, self.streaming, &self.reasoning_effort)
            .await;
    }
}

pub struct Refiner {
    client: LMClient,
    model: String,
    conjecture: String,
    proof: String,
    review: String,
    streaming: bool,
    context: Option<String>,
    reasoning_effort: String,
}

impl Refiner {
    pub fn new() -> Self {
        Refiner {
            client: LMClient::new(),
            model: String::new(),
            conjecture: String::new(),
            proof: String::new(),
            review: String::new(),
            streaming: false,
            context: None,
            reasoning_effort: "medium".into(),
        }
    }
    pub fn model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }
    pub fn streaming(mut self, streaming: bool) -> Self {
        self.streaming = streaming;
        self
    }
    pub fn set_conjecture(&mut self, conjecture: impl Into<String>) -> &Self {
        self.conjecture = conjecture.into();
        self
    }
    pub fn set_proof(&mut self, proof: impl Into<String>) -> &Self {
        self.proof = proof.into();
        self
    }
    pub fn set_review(&mut self, review: impl Into<String>) -> &Self {
        self.review = review.into();
        self
    }
    pub fn set_context(&mut self, context: impl Into<String>) -> &Self {
        self.context = Some(context.into());
        self
    }
    pub fn reasoning_effort(mut self, effort: impl Into<String>) -> Self {
        self.reasoning_effort = effort.into();
        self
    }
}

#[async_trait::async_trait]
impl Agent for Refiner {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let conjecture_proof_review = format!(
            "### Conjecture\n\n{}\n\n### Proof\n\n{}\n\n### Review\n\n{}",
            &self.conjecture, &self.proof, &self.review
        );
        let mut context_prefix = String::new();
        if let Some(context) = &self.context {
            context_prefix = format!(
                "\n\n### Context and History Explorations\n\nHere is a list of context that we have collected for this problem or our history findings during exploration. They serve as the background of the conjecture and proof, and can be accepted without controversy as correct.\n\n{}",
                context
            );
        }
        let prompt = concat!(
            "### Instruction\n",
            "\n",
            "You are an expert that is knowledgeable across all domains in math. This time you are asked to help with frontier math research. We have proposed a new conjecture, and tried to prove it. However, one reviewer have found some flaws in our proof. You need to help us with our research project by:\n",
            "\n",
            "1. Please try to refine or even completely rewrite the proof so that it can be **correct**, **complete** and **rigorous**. You should wrap your new proof inside latex environment as \\begin{proof}\\end{proof} in your response. Once you have done this refinement, you should write down a \"\\boxed{true}\" at the end of your response.\n",
            "2. And if you believe this conjecture itself is not true, please state the opposite of this conjecture inside \\begin{conjecture}\\end{conjecture}, and your rationales or proofs of this judgement inside \\begin{proof}\\end{proof}. Finally you should write down a \"\\boxed{false}\" at the end of your response.\n",
            "\n"
        ).to_string() + &conjecture_proof_review + &context_prefix;
        return self
            .client
            .comp(&prompt, &self.model, self.streaming, &self.reasoning_effort)
            .await;
    }
}

pub struct Formatter {
    client: LMClient,
    model: String,
    content: String,
    reasoning_effort: String,
}

impl Formatter {
    pub fn new() -> Self {
        Formatter {
            client: LMClient::new(),
            model: String::new(),
            content: String::new(),
            reasoning_effort: "medium".into(),
        }
    }
    pub fn model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }
    pub fn content(mut self, content: impl Into<String>) -> Self {
        self.content = content.into();
        self
    }
    pub fn reasoning_effort(mut self, effort: impl Into<String>) -> Self {
        self.reasoning_effort = effort.into();
        self
    }
}

#[async_trait::async_trait]
impl Agent for Formatter {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let prompt = concat!(
            "Please help me rewrite these math related contents into standard markdown format for preview. You should obey the following instructions when completing this task:\n",
            "\n",
            "1. DO NOT modify or alter the original meaning in these contents.\n",
            "2. You should not use headings in the reformatted contents.\n",
            "3. Each math formula should be wrapped in dollars like $ $ for inline formula and $$ $$ for multiline one.\n",
            "4. You should wrap the reformatted contents inside latex environment as \\begin{contents}reformatted contents here\\end{contents}\n",
            "\n",
            "Here is the original contents:\n",
            "\n").to_string() + &format!("\\begin{{contents}}{}\\end{{contents}}", self.content);
        return self
            .client
            .comp(&prompt, &self.model, false, &self.reasoning_effort)
            .await;
    }
}

pub struct ProofSummarizer {
    client: LMClient,
    model: String,
    conjecture: String,
    proof: String,
    reasoning_effort: String,
}

impl ProofSummarizer {
    pub fn new() -> Self {
        ProofSummarizer {
            client: LMClient::new(),
            model: String::new(),
            conjecture: String::new(),
            proof: String::new(),
            reasoning_effort: "medium".into(),
        }
    }
    pub fn model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }
    pub fn conjecture(mut self, conjecture: impl Into<String>) -> Self {
        self.conjecture = conjecture.into();
        self
    }
    pub fn proof(mut self, proof: impl Into<String>) -> Self {
        self.proof = proof.into();
        self
    }
    pub fn reasoning_effort(mut self, effort: impl Into<String>) -> Self {
        self.reasoning_effort = effort.into();
        self
    }
}

#[async_trait::async_trait]
impl Agent for ProofSummarizer {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let prompt = concat!(
            "You will be given a mathematical conjecture and its proof.\n",
            "Your task is to carefully read and understand the proof, then produce a clear and concise summary that includes:\n",
            "1. **Overall Overview** – a brief description of the main idea and approach of the proof.\n",
            "2. **Key Steps** – the essential logical steps in the proof, listed or described in order.\n",
            "3. **Main Ideas / Techniques** – important mathematical concepts, techniques, or strategies applied in the proof.\n",
            "\n",
            "Do not rewrite the full proof or include excessive details.\n",
            "Focus on extracting and condensing the essence of the proof’s reasoning.\n",
            "Present the final result strictly inside the following tags:\n",
            "```\n",
            "\\begin{summary}\n",
            "[Your concise summary here]\n",
            "\\end{summary}\n",
            "```\n",
            "Ensure that the summary is self-contained and understandable without referencing the original text.\n",
            "\n").to_string() + &format!("\\begin{{conjecture}}{}\\end{{conjecture}}\n\\begin{{proof}}{}\\end{{proof}}", self.conjecture, self.proof);
        return self
            .client
            .comp(&prompt, &self.model, false, &self.reasoning_effort)
            .await;
    }
}
