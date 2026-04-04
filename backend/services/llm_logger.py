"""
LLM Observability — wraps every Anthropic API call to log tokens, latency, and cost.
Usage:
    from backend.services.llm_logger import tracked_call
    response = tracked_call(client, call_type="extraction", document_id=42, **kwargs)
"""
import time
from datetime import datetime
from typing import Optional, Any, Dict

import anthropic

from backend.db.database import SessionLocal

# claude-sonnet-4-6 pricing (April 2026): $3/M input, $15/M output
MODEL_PRICING: Dict[str, tuple] = {
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-opus-4-6":   (15.00, 75.00),
    "claude-haiku-4-5":  (0.25, 1.25),
}
DEFAULT_PRICING = (3.00, 15.00)


def _compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    price_in, price_out = MODEL_PRICING.get(model, DEFAULT_PRICING)
    return (input_tokens / 1_000_000) * price_in + (output_tokens / 1_000_000) * price_out


def tracked_call(
    client: anthropic.Anthropic,
    call_type: str,
    document_id: Optional[int] = None,
    prompt_version_id: Optional[int] = None,
    **kwargs,
) -> anthropic.types.Message:
    """
    Wraps client.messages.create(**kwargs) with full observability logging.
    Returns the original Message response transparently.
    """
    start_ms = time.monotonic()
    error_text = None
    response = None

    try:
        response = client.messages.create(**kwargs)
        return response
    except Exception as e:
        error_text = str(e)
        raise
    finally:
        latency_ms = int((time.monotonic() - start_ms) * 1000)
        model = kwargs.get("model", "unknown")

        input_tokens = 0
        output_tokens = 0
        stop_reason = None
        cost = 0.0

        if response is not None:
            usage = getattr(response, "usage", None)
            if usage:
                input_tokens = getattr(usage, "input_tokens", 0)
                output_tokens = getattr(usage, "output_tokens", 0)
            stop_reason = getattr(response, "stop_reason", None)
            cost = _compute_cost(model, input_tokens, output_tokens)

        # Write to DB in a separate session so it always commits even if caller rolls back
        _write_log(
            call_type=call_type,
            model=model,
            prompt_version_id=prompt_version_id,
            document_id=document_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            cost_usd=cost,
            stop_reason=stop_reason,
            error=error_text,
        )


def _write_log(**kwargs):
    try:
        from backend.models.orm import LLMCallLog
        db = SessionLocal()
        try:
            log = LLMCallLog(**kwargs)
            db.add(log)
            db.commit()
        finally:
            db.close()
    except Exception:
        pass  # Never let logging crash the main flow
