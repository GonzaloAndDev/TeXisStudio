pub mod claude_provider;
pub mod gemini_provider;
pub mod openai_provider;

use super::response::{AiProviderError, AiResponse};

#[allow(dead_code)]
pub type ProviderResult = Result<AiResponse, AiProviderError>;
