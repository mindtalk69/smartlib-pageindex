import logging
from typing import Any, Dict, List, Union
from langchain_core.messages import BaseMessage
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import ChatGenerationChunk, GenerationChunk, LLMResult

class UsageMetadataCallbackHandler(BaseCallbackHandler):
    """Callback handler to extract token usage and model name."""

    def __init__(self):
        super().__init__()
        self.usage_metadata = {}        
        logging.info("[Callback] UsageMetadataCallbackHandler initialized.") # Add init log

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Log when LLM starts."""
        logging.info("[Callback] LLM Start triggered.") # Add start log
        # Reset metadata at the start of each LLM call
        self.usage_metadata = {}

    def on_chat_model_start(
        self,
        serialized: Dict[str, Any],
        messages: List[List[BaseMessage]], # Correct type hint
        **kwargs: Any,
    ) -> Any:
        """Run when Chat Model starts running."""
        logging.info("[Callback] Chat Model Start triggered.") # Add chat model start log

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Extract token usage and model name from the LLM response."""
        logging.info("[Callback] on_llm_end triggered.") # Add end log
        logging.debug(f"[Callback] on_llm_end received response object: {response}") # DEBUG log
        extracted_usage = {}
        model_name = None

        try:
            # logging.debug(f"[LangSmithRunManager] on_llm_end called. Response: {response}") # DEBUG - Replaced by above log
            # --- Attempt 1: Standard OpenAI/Azure format in llm_output ---
            if response.llm_output and 'token_usage' in response.llm_output:
                token_usage = response.llm_output['token_usage']
                model_name = response.llm_output.get('model_name', None)
                extracted_usage = {
                    "input_tokens": token_usage.get("prompt_tokens", 0),
                    "output_tokens": token_usage.get("completion_tokens", 0),
                    "total_tokens": token_usage.get("total_tokens", 0),
                }
                logging.info(f"[Callback] Extracted usage from response.llm_output['token_usage']: {extracted_usage}")

            # --- Attempt 2: Check response.generations[...].generation_info (Common for others) ---
            elif response.generations:
                logging.debug(f"[Callback] Checking response.generations structure: {response.generations}")
                for gen_list in response.generations:
                    for gen in gen_list:
                        if isinstance(gen, (ChatGenerationChunk, GenerationChunk)): continue
                        if gen.generation_info and 'token_usage' in gen.generation_info:
                             token_usage = gen.generation_info['token_usage']
                             model_name = gen.generation_info.get('model_name', model_name)
                             extracted_usage = {
                                 "input_tokens": token_usage.get("prompt_tokens", 0),
                                 "output_tokens": token_usage.get("completion_tokens", 0),
                                 "total_tokens": token_usage.get("total_tokens", 0),
                             }
                             logging.info(f"[Callback] Extracted usage from response.generations[...].generation_info['token_usage']: {extracted_usage}")
                             break
                        # --- Attempt 2b: Check response.generations[...].message.usage_metadata (Newer Langchain/Azure format) ---
                        elif hasattr(gen, 'message') and hasattr(gen.message, 'usage_metadata') and gen.message.usage_metadata:
                             token_usage = gen.message.usage_metadata
                             model_name = gen.generation_info.get('model_name', model_name) # Still get model from generation_info
                             extracted_usage = {
                                 "input_tokens": token_usage.get("input_tokens", 0), # Key names might be different
                                 "output_tokens": token_usage.get("output_tokens", 0),
                                 "total_tokens": token_usage.get("total_tokens", 0),
                             }
                             logging.info(f"[Callback] Extracted usage from response.generations[...].message.usage_metadata: {extracted_usage}")
                             break
                        elif gen.generation_info and 'usage_metadata' in gen.generation_info: # Google Vertex AI
                            usage_metadata_google = gen.generation_info['usage_metadata']
                            model_name = gen.generation_info.get('model_name', model_name)
                            extracted_usage = {
                                "input_tokens": usage_metadata_google.get("prompt_token_count", 0),
                                "output_tokens": usage_metadata_google.get("candidates_token_count", 0),
                                "total_tokens": usage_metadata_google.get("total_token_count", 0),
                            }
                            logging.info(f"[Callback] Extracted usage from Google Vertex AI structure (generation_info['usage_metadata']): {extracted_usage}")
                            break
                    if extracted_usage: break

            # --- Log if no usage found ---
            if not extracted_usage: logging.warning("[Callback] Could not find token usage information in known locations.")
            self.usage_metadata = extracted_usage
            if model_name: self.usage_metadata["model"] = model_name
            logging.info(f"[Callback] Final usage_metadata set: {self.usage_metadata}")
        except Exception as e:
            logging.error(f"[Callback] Error processing LLM response in callback: {e}", exc_info=True)
            self.usage_metadata = {} # Reset on error

    def on_llm_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        """Log LLM errors."""
        logging.error(f"[Callback] LLM Error: {error}", exc_info=True)
        self.usage_metadata = {} # Reset on error

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        """Run when chain ends running."""
        logging.debug(f"[Callback] Chain End triggered. Outputs: {outputs}")