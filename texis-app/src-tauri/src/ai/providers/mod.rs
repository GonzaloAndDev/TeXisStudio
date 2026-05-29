pub mod claude_provider;
pub mod gemini_provider;
pub mod openai_provider;

use super::request::AiRequest;
use super::response::{AiProviderError, AiResponse};

pub type ProviderResult = Result<AiResponse, AiProviderError>;
