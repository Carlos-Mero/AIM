use regex::Regex;
use regex::escape as regex_escape;
use log::warn;

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
