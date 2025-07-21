use regex::Regex;
use regex::escape as regex_escape;
use log::{info, warn, error};
use std::process::Stdio;
use tokio::io::{AsyncWriteExt};
use tokio::process::Command;

pub fn find_box(pred_str: &str) -> Option<String> {
    let after_boxed = match pred_str.rfind("boxed") {
        Some(pos) => &pred_str[pos + 5..], // 5 is the length of "boxed"
        None => return None,
    };

    if after_boxed.is_empty() {
        return None;
    }

    if after_boxed.starts_with('{') {
        let mut stack = 1;
        let mut result = String::new();
        let mut chars = after_boxed.chars().skip(1);
        while let Some(c) = chars.next() {
            match c {
                '{' => stack += 1,
                '}' => {
                    stack -= 1;
                    if stack == 0 {
                        break;
                    }
                }
                _ => {}
            }
            result.push(c);
        }
        Some(result)
    } else {
        let end = after_boxed.find('$').unwrap_or(after_boxed.len());
        let result = after_boxed[..end].trim().to_string();
        if result.is_empty() {
            None
        } else {
            Some(result)
        }
    }
}

pub fn extract_component(text: &str, tag: &str) -> Option<String> {
    // Extract the content in the last latex component (tags excluded)
    let escaped_tag = regex_escape(tag);
    let pattern = format!(r"(?s)\\begin\{{{0}\}}((?:.|\n)*?)\\end\{{{0}\}}", escaped_tag);
    let re = Regex::new(&pattern).ok()?;
    
    re.captures_iter(text)
        .last()
        .and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        .or_else(|| {
            warn!("No content extracted for tag: {}", tag);
            None
        })
}

pub fn extract_all_component(text: &str, tag: &str) -> Vec<String> {
    // Extract all the content in the xml-style tag (tags excluded)
    let escaped_tag = regex_escape(tag);
    let pattern = format!(r"(?s)\\begin\{{{0}\}}((?:.|\n)*?)\\end\{{{0}\}}", escaped_tag);
    let re = match Regex::new(&pattern) {
        Ok(re) => re,
        Err(e) => {
            warn!("Invalid regex for tag '{}': {}", tag, e);
            return Vec::new();
        }
    };

    let contents: Vec<_> = re.captures_iter(text)
        .filter_map(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        .collect();

    if contents.is_empty() {
        warn!("No content found for tag: {}", tag);
    }
    contents
}

fn extract_report_from_deer_flow(raw_output: &str) -> String {
    // This function extracts the report content from the output of deer-flow cli
    // It might need to be frequently updated to fit new versions of deer-flow
    const MARKER: &str = "reporter response:";
    let truncated_content = match raw_output.find(MARKER) {
        Some(index) => {
            &raw_output[index + MARKER.len()..].trim_start()
        }
        None => {
            warn!("The \"{}\" was not found in the output of deer flow", MARKER);
            warn!("Raw output content: {}", raw_output);
            ""
        }
    };
    if truncated_content.is_empty() {
        warn!("Failed to extract report content from deer flow.");
        return String::new();
    }
    let log_line_regex = Regex::new(r"^\d{4}-\d{2}-\d{2}").unwrap();
    let cleaned_lines: Vec<&str> = truncated_content
        .lines()
        .filter(|line| !log_line_regex.is_match(line))
        .collect();
    return cleaned_lines.join("\n");
}

pub async fn search_bkg_deer_flow(problem: &str) -> Result<String, Box<dyn std::error::Error>> {
    // This function starts a new process to run deer-flow with uv venv
    // This will try to extract background information, recent findings and methods for the given
    // problem, and returns an empty string if it failed
    let mut df_process = Command::new("uv")
        .args(&["run", "main.py"])
        .current_dir("./deer-flow")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    info!("Started deer-flow as a subprocess to extract backgrounds for this problem");
    let mut child_stdin = df_process.stdin.take().expect("Failed to open the stdin of deer-flow process");
    let problem_content: String = problem.to_string();
    let stdin_task = tokio::spawn(async move {
        let prompt_to_deer_flow = 
            format!("I am currently working on a math problem, and I want you to help me make a survey on the background of this problem. You should search through relevant papers on arxiv, and for each paper you have collected, you need to summarize two primary information for me. 1. important lemmas and theorems obtained in this paper; 2. the methods used in this paper to obtain the desired conclusion. Please explain both the theoretical results and methods in detail in your report. The problem I am working on is \"{}\".", problem_content);
        child_stdin.write_all(
            prompt_to_deer_flow.as_bytes()
        ).await.expect("Failed to write to stdin of deer-flow");
        child_stdin.shutdown().await.expect("Failed to shutdown the stdin of deer-flow");
    });
    stdin_task.await?;
    let output = df_process.wait_with_output().await?;
    if output.status.success() {
        return Ok(extract_report_from_deer_flow(&String::from_utf8_lossy(&output.stderr)));
    } else {
        error!("deer-flow process failed with status: {}", output.status);
        error!("deer-flow stdout: {}", String::from_utf8_lossy(&output.stdout));
        error!("deer-flow stderr: {}", String::from_utf8_lossy(&output.stderr));
        return Ok(String::new());
    }
}
