use log::{info, debug, warn, error};
use tokio::task::JoinSet;
use futures_util::StreamExt;
use serde_json::json;

use serde::{Serialize, Deserialize};
use indicatif::{ProgressBar, ProgressStyle};
use crate::utils::find_box;
use std::sync::Arc;
use dotenvy::dotenv;
use std::env;
use std::time::Duration;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(1800);
const API_RETRY_DELAY: Duration = Duration::from_secs(2);
const MAX_REQWEST_RETRIES: u8 = 7;
const MAX_CHUNK_DECODE_RETRIES: u8 = 16;

#[derive(Default, Debug, Serialize, Deserialize)]
pub struct MemoryBlock {
    pub memtype: String,
    pub content: String,
    pub proof: String,

    // Used in memory graph, Working in process
    solved: bool,
    reviews: u8,
    comment: String,
    deps: Vec<usize>
}

impl MemoryBlock {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn memtype(mut self, memtype: impl Into<String>) -> Self {self.memtype = memtype.into(); self}
    pub fn content(mut self, content: impl Into<String>) -> Self {self.content = content.into(); self}
    pub fn proof(mut self, proof: impl Into<String>) -> Self {self.proof = proof.into(); self}
    pub fn solved(mut self, solved: bool) -> Self {self.solved = solved; self}
    pub fn reviews(mut self, reviews: u8) -> Self {self.reviews = reviews; self}
    pub fn comment(mut self, comment: impl Into<String>) -> Self {self.comment = comment.into(); self}
    pub fn deps(mut self, deps: Vec<usize>) -> Self {self.deps = deps; self}

    pub fn _format(&self) -> String {
        format!("<{0}>\n**content**: {1}\n</{0}>", &self.memtype, &self.content)
    }
    pub fn _format_with_proof(&self) -> String {
        format!("<{0}>\n\n**content**: {1}\n**proof**: {2}\n</{0}>", &self.memtype, &self.content, &self.proof)
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
    pub fn format_all(&self) -> Option<String> {
        // Format all memory blocks as the input of other agents
        if self.memory.is_empty() {
            None
        } else {
            Some(
                self.memory
                    .iter()
                    .enumerate()
                    .map(|(i, mem)| format!("#### Memory **ID: {i}**\n\n{}\n\n", mem._format()))
                    .collect::<String>(),
            )
        }
    }
    pub fn format_all_with_proof(&self) -> Option<String> {
        // Format all memory blocks with proofs as the final output
        if self.memory.is_empty() {
            None
        } else {
            Some(
                self.memory
                    .iter()
                    .enumerate()
                    .map(|(i, mem)| format!("#### Memory **ID: {i}**\n\n{}\n\n", mem._format_with_proof()))
                    .collect::<String>(),
            )
        }
    }
}

#[derive(Clone)]
pub struct LMClient {
    client: reqwest::Client,
    api_key: String,
    base_url: String
}

impl LMClient {
    pub fn new() -> Self {
        if let Err(e) =  dotenv() {
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
        let base_url = env::var("OPENAI_API_BASEURL").unwrap_or_else(|_| 
            "https://api.openai.com".into());

        let client = reqwest::Client::builder()
            .no_proxy()
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .build().unwrap();
        LMClient { client: client, api_key: api_key, base_url: base_url.into() }
    }

    async fn comp(&self, prompt: &str, model: &str, stream_output: bool) -> Result<String, Box<dyn std::error::Error>> {
        let request_body = json!({
            "model": model,
            "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
            "temperature": 0.6,
            "stream": true
        });
        let url = format!("{}/v1/chat/completions", &self.base_url.trim_end_matches('/'));

        let mut attempt: u8 = 0;

        loop {
            debug!("Sending request to url {}, Attempt {}:\n{:#?}", &url, attempt, &request_body);
            attempt += 1;

            let response = self.client
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

                        for line in chunk_str.lines() {
                            if line.starts_with("data:") {
                                let data_str = line.trim_start_matches("data:").trim();

                                if data_str == "[DONE]" {
                                    continue;
                                }

                                match serde_json::from_str::<serde_json::Value>(data_str) {
                                    Ok(data) => {
                                        if let Some(content) = data["choices"][0]["delta"]["reasoning_content"].as_str() {
                                            if stream_output {print!("{}", &content)}
                                        }
                                        if let Some(content) = data["choices"][0]["delta"]["content"].as_str() {
                                            if stream_output {print!("{}", &content)}
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
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error>>;
}

pub struct Explorer {
    client: LMClient,
    model: String,
    problem: String,
    streaming: bool,
    context: Option<String>,
}

impl Explorer {
    pub fn new() -> Self {
        Explorer { client: LMClient::new(), model: String::new(), problem: String::new(), streaming: false, context: None }
    }
    pub fn model(mut self, model: impl Into<String>) -> Self {self.model = model.into(); self}
    pub fn streaming(mut self, streaming: bool) -> Self {self.streaming = streaming; self}
    pub fn set_problem(&mut self, problem: impl Into<String>) -> &Self {self.problem = problem.into(); self}
    pub fn set_context(&mut self, context: impl Into<String>) -> &Self {self.context = Some(context.into()); self}
}

#[async_trait::async_trait]
impl Agent for Explorer {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error>> {
        let problem_stat = format!("<problem>{}</problem>", &self.problem);
        let mut context_prefix = String::new();
        if let Some(context) = &self.context {
            context_prefix = format!("\n\nHere is a list of context that we have collected for this problem or our history findings during exploration. They can be accepted without controversy as correct, and you can begin your exploration based on them.\n\n### Context and History Explorations\n\n{}", context);
        }
        let prompt = concat!("### Instruction\n",
             "\n",
             "You are an expert that is knowledgeable across all domains in math. This time you are asked to help solve a frontier math problem. Its statement is as follows:\n",
             "\n").to_string() + 
             &problem_stat + 
             concat!("\n",
             "This problem could be difficult and can not be directly solved, but you can make your contribution with the following instructions:\n",
             "\n",
             "1. You need to explore different approaches or directions that might help with our final goal.\n",
             "2. You need to include one or more interesting findings in your explorations as conjectures in your response.\n",
             "3. Do not present any existing lemmas as your new conjectures. You can directly use them in your explorations.\n",
             "4. You should wrap them inside two tags of xml style: <conjecture></conjecture>, and each of them should be equiped with a detailed, complete and rigorous proof.\n",
             "5. You should explicitly write down every intermediate steps in derivations and calculations in the proof.\n",
             "6. The proof should be wrapped in <proof></proof> tags directly followed by the conjecture.\n",
             "\n",
             "More accurately, each conjectures in your response should follow the format below:\n",
             "\n",
             "<conjecture>Your new findings here</conjecture>\n",
             "<proof>Your proof of the conjecture above</proof>\n",
             "\n",
             "Your conjectures will then be verified and collected as the basis for future explorations.",
             "Moreover, when you think the time is right that you are able to prove the original problem, you can simply state your proof inside <final_proof></final_proof>.",
             "Do not include these components if you are not sure about the final proof.",
             "Remember that the final proof should be a complete proof that do not depend on any other unsolved conjectures.")
             + &context_prefix;

        return self.client.comp(&prompt, &self.model, self.streaming).await;
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
}

impl Reviewer {
    pub fn new() -> Self {
        Reviewer {client: LMClient::new(), model: String::new(), conjecture: String::new(), proof: String::new(), reviews: 0, streaming: false, context: None}
    }
    pub fn model(mut self, model: impl Into<String>) -> Self {self.model = model.into(); self}
    pub fn reviews(mut self, reviews: u8) -> Self {self.reviews = reviews; self}
    pub fn streaming(mut self, streaming: bool) -> Self {self.streaming = streaming; self}
    pub fn set_conjecture(&mut self, conjecture: impl Into<String>) -> &Self {self.conjecture = conjecture.into(); self}
    pub fn set_proof(&mut self, proof: impl Into<String>) -> &Self {self.proof = proof.into(); self}
    pub fn set_context(&mut self, context: impl Into<String>) -> &Self {self.context = Some(context.into()); self}

    pub async fn pverify(self: Arc<Self>) -> Option<String> {
        // pessimistic verification for the given conjecture and proof
        // it will return a string of reviews if some flaws are found in the proof or conjecture
        // or else it will return None when no problem is found
        info!("Starting pverify with **{}** reviewers.", self.reviews);
        let pb = ProgressBar::new(self.reviews as u64);
        if let Ok(style) = ProgressStyle::with_template(
            "{msg} [{elapsed_precise}] {wide_bar} {pos}/{len} (eta: {eta})"
        ) {
            pb.set_style(style);
        } else {warn!("Incorrect style template for progressbar.");}
        pb.set_message("pverifying");

        let mut tasks: JoinSet<Option<String>> = JoinSet::new();
        for _ in 0..self.reviews {
            let n_reviewer = self.clone();
            let n_pb = pb.clone();
            tasks.spawn(async move {
                let res = match n_reviewer._process().await {
                    Ok(s) => Some(s),
                    Err(e) => {error!("Error Occured when reviewing: {}", e); None}
                };
                n_pb.inc(1);
                res
            });
        }

        while let Ok(review) = tasks.join_next().await? {
            if let Some(r) = review {
                if find_box(&r)? == "invalid" {
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
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error>> {
        let conjecture_proof = format!("### Conjecture\n\n{}\n\n### Proof\n\n{}", &self.conjecture, &self.proof);
        let mut context_prefix = String::new();
        if let Some(context) = &self.context {
            context_prefix = format!("\n\n### Context and History Explorations\n\nHere is a list of context that we have collected for this problem or our history findings during exploration. They serve as the background of the conjecture and proof and can be accepted without controversy as correct.\n\n{}", context);
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
        return self.client.comp(&prompt, &self.model, self.streaming).await;
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
}

impl Refiner {
    pub fn new() -> Self {
        Refiner { client: LMClient::new(), model: String::new(), conjecture: String::new(), proof: String::new(), review: String::new(), streaming: false, context: None }
    }
    pub fn model(mut self, model: impl Into<String>) -> Self {self.model = model.into(); self}
    pub fn streaming(mut self, streaming: bool) -> Self {self.streaming = streaming; self}
    pub fn set_conjecture(&mut self, conjecture: impl Into<String>) -> &Self {self.conjecture = conjecture.into(); self}
    pub fn set_proof(&mut self, proof: impl Into<String>) -> &Self {self.proof = proof.into(); self}
    pub fn set_review(&mut self, review: impl Into<String>) -> &Self {self.review = review.into(); self}
    pub fn set_context(&mut self, context: impl Into<String>) -> &Self {self.context = Some(context.into()); self}
}

#[async_trait::async_trait]
impl Agent for Refiner {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error>> {
        let conjecture_proof_review = format!("### Conjecture\n\n{}\n\n### Proof\n\n{}\n\n### Review\n\n{}", &self.conjecture, &self.proof, &self.review);
        let mut context_prefix = String::new();
        if let Some(context) = &self.context {
            context_prefix = format!("\n\n### Context and History Explorations\n\nHere is a list of context that we have collected for this problem or our history findings during exploration. They serve as the background of the conjecture and proof, and can be accepted without controversy as correct.\n\n{}", context);
        }
        let prompt = concat!(
             "### Instruction\n",
             "\n",
             "You are an expert that is knowledgeable across all domains in math. This time you are asked to help with frontier math research. We have proposed a new conjecture, and tried to prove it. However, one reviewer have found some flaws in our proof. You need to help refine or even completely rewrite the proof so that it can be **correct**, **complete** and **rigorous**. You can also modify the statement of this conjecture itself if needed. You should wrap the conjecture in <conjecture></conjecture> tags and the proof in <proof></proof> tags as follows in your response:\n",
             "\n",
             "<conjecture>original or modified conjecture</conjecture>\n",
             "<proof>refined proof of the conjecture above</proof>\n",
             "\n").to_string() + &conjecture_proof_review + &context_prefix;
        return self.client.comp(&prompt, &self.model, self.streaming).await;
    }
}

pub struct Formatter {
    client: LMClient,
    model: String,
    content: String,
}

impl Formatter {
    pub fn new() -> Self {Formatter { client: LMClient::new(), model: String::new(), content: String::new() }}
    pub fn model(mut self, model: impl Into<String>) -> Self {self.model = model.into(); self}
    pub fn content(mut self, content: impl Into<String>) -> Self {self.content = content.into(); self}
}

#[async_trait::async_trait]
impl Agent for Formatter {
    async fn _process(&self) -> Result<String, Box<dyn std::error::Error>> {
        let prompt = concat!(
            "Please help me rewrite these math related contents into standard markdown format for preview. You should obey the following instructions when completing this task:\n",
            "\n",
            "1. DO NOT modify or alter the original meaning in these contents.\n",
            "2. You should not use headings in the reformatted contents.\n",
            "3. Each math formula should be wrapped in dollars like $ $ for inline formula and $$ $$ for multiline one.\n",
            "4. You should wrap the reformatted contents inside xml style tags as <markdown>reformatted contents here</markdown>\n",
            "\n",
            "Here is the original contents:\n",
            "\n").to_string() + &format!("<original_contents>{}</original_contents>", self.content);
        return self.client.comp(&prompt, &self.model, false).await;
    }
}
