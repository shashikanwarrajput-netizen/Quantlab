"""
QuantLab AI Service - Production LLM Orchestrator & Conversational Intelligence.
Supports Google Gemini, Groq, OpenAI, and a structured Offline Knowledge Engine.
"""

from __future__ import annotations

import os
import re
from typing import Any, Optional
import httpx
from dotenv import load_dotenv

from backend.services.offline_ai import get_offline_response
from backend.services.quant_engine import compute_live_technical_summary

load_dotenv()

# Master System Prompt defined in Section 5 of project specification
MASTER_SYSTEM_PROMPT = """You are QuantLab AI, an intelligent, conversational, general-purpose AI assistant with advanced expertise in quantitative finance, algorithmic trading, financial mathematics, programming, cybersecurity, science, technology, and general knowledge.

Your primary responsibility is to understand the user's actual question and provide a relevant, accurate, clear, and contextually appropriate answer.

You are not a fixed-response chatbot. Do not repeat predefined answers for unrelated questions. Do not rely exclusively on keyword matching. Interpret the meaning, intent, constraints, and context of each request before answering.

GENERAL BEHAVIOR:
1. Answer the exact question the user asks.
2. Support both general-purpose questions and specialized financial questions.
3. Adapt the depth of your response to the complexity of the question.
4. Use simple explanations when requested and technical detail when appropriate.
5. Provide examples, calculations, code, comparisons, and step-by-step instructions when useful.
6. If the user asks a follow-up question, connect it to the relevant previous conversation.
7. Do not ask users to repeat information already available in the conversation.
8. If essential information is missing, ask a concise clarifying question.
9. If you do not know something, acknowledge the uncertainty instead of inventing facts.
10. Do not claim to have searched the internet, accessed live data, executed code, or performed an action unless that actually occurred.

CONVERSATION MEMORY:
- Use the supplied conversation history to understand references such as 'it', 'that strategy', 'explain further', and 'why did this happen?'
- Preserve the relevant context of earlier messages.
- Distinguish the current question from previous questions.
- Do not answer a new question with an old response simply because the topics are similar.
- Summarize older conversation context when necessary to remain within the context window.

GENERAL KNOWLEDGE:
- Answer questions about programming, cybersecurity, mathematics, science, technology, education, writing, and everyday topics.
- Do not redirect unrelated questions toward stock markets or quantitative finance.
- Explain concepts at the user's requested level.

QUANTITATIVE FINANCE:
- Explain trading strategies, technical indicators, options, derivatives, portfolio construction, and risk management accurately.
- Use actual market or backtest data only when it is available in the supplied context or through a working data integration.
- Distinguish historical backtest results from live market performance and future predictions.
- Explain assumptions, limitations, and relevant risks.
- Never guarantee investment returns.

PROGRAMMING:
- Generate practical, syntactically valid code when possible.
- Explain how to execute, test, and debug the code when appropriate.
- Do not claim that code was executed unless an execution tool actually ran it.
- Ask for relevant error messages or source code when needed.

ACCURACY:
- Separate verified facts, assumptions, estimates, and opinions.
- Perform calculations carefully.
- Do not fabricate live market prices, news, citations, or API results.
- For time-sensitive information, use an available reliable data source or explicitly state that current verification is unavailable.

RESPONSE STYLE:
- Use natural, human-readable language.
- Avoid unnecessary repetition, generic introductions, and irrelevant disclaimers.
- Give a direct answer first, followed by explanations or examples as needed.
- Use Markdown formatting for headings, lists, tables, and code blocks when helpful.
- Do not force every answer into the same structure.
- Keep simple answers concise and complex answers sufficiently detailed.

Your goal is to provide a genuinely useful conversational experience in which each answer is determined by the user's question, the relevant context, and the available evidence."""


class LLMProviderError(Exception):
    """Exception raised when an LLM provider call fails."""
    def __init__(self, message: str, status_code: int = 502, provider: str = "unknown") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.provider = provider


def redact_secret(text: str, key: Optional[str] = None) -> str:
    """Ensure sensitive API keys never appear in logs or errors."""
    if not text:
        return ""
    clean = text
    if key and len(key) > 6:
        clean = clean.replace(key, f"{key[:3]}...{key[-3:]}")
    # Common token patterns
    clean = re.sub(r'(AIza[0-9A-Za-z-_]{35})', '[REDACTED_GEMINI_KEY]', clean)
    clean = re.sub(r'(sk-[a-zA-Z0-9_-]{20,})', '[REDACTED_OPENAI_KEY]', clean)
    clean = re.sub(r'(gsk_[a-zA-Z0-9_-]{20,})', '[REDACTED_GROQ_KEY]', clean)
    clean = re.sub(r'(AQ\.[a-zA-Z0-9_.-]{20,})', '[REDACTED_GEMINI_KEY]', clean)
    return clean


def is_market_query(query: str, symbol: str) -> bool:
    """Determine if query is asking for stock, technicals, or market data."""
    q = query.lower()
    sym = symbol.lower()
    keywords = [
        sym, "stock", "price", "rsi", "moving average", "sma", "dma",
        "market regime", "trend", "nse", "bse", "nifty", "sensex",
        "quote", "today's price", "bullish", "bearish", "trading tick"
    ]
    return any(k in q for k in keywords)


def is_backtest_query(query: str) -> bool:
    """Determine if query is asking about strategy backtest, equity, or alpha."""
    q = query.lower()
    keywords = [
        "backtest", "my strategy", "underperform", "benchmark",
        "sharpe", "drawdown", "win rate", "trades", "cagr",
        "alpha", "equity curve", "crossover", "mean reversion"
    ]
    return any(k in q for k in keywords)


def build_context_prompt(
    query: str,
    symbol: str,
    tech: dict[str, Any],
    latest_analytics: Optional[dict[str, Any]],
) -> str:
    """Selectively append market and backtest data only when relevant to the user query."""
    context_chunks = []

    if is_market_query(query, symbol):
        cur_p = tech.get("current_price", 0.0)
        chg = tech.get("change_pct", 0.0)
        context_chunks.append(
            f"LIVE MARKET CONTEXT FOR {symbol.upper()}:\n"
            f"- Current Price: Rs {cur_p:,.2f} ({chg:+.2f}%)\n"
            f"- Technical Regime: {tech.get('regime', 'Neutral')}\n"
            f"- 14-Day RSI: {tech.get('rsi_14', 50.0):.1f}\n"
            f"- 20-DMA: Rs {tech.get('sma_20', cur_p):,.2f} | 50-DMA: Rs {tech.get('sma_50', cur_p):,.2f}"
        )

    if is_backtest_query(query) and latest_analytics:
        m = latest_analytics.get("metrics", {})
        algo = latest_analytics.get("algorithm", "Strategy")
        context_chunks.append(
            f"USER'S LATEST BACKTEST DATA ({algo} on {latest_analytics.get('symbol', symbol)}):\n"
            f"- Strategy Total Return: {m.get('totalReturnPct', 0):+.2f}%\n"
            f"- Benchmark Return: {m.get('benchmarkReturnPct', 0):+.2f}%\n"
            f"- Annualized Sharpe Ratio: {m.get('sharpeRatio', 'N/A')}\n"
            f"- Maximum Drawdown: {m.get('maxDrawdownPct', 0):.2f}%\n"
            f"- Total Trades: {m.get('totalTrades', 0)} (Win Rate: {m.get('winRatePct', 0):.1f}%)\n"
            f"- CAGR: {m.get('cagrPct', 0):.2f}%"
        )

    if context_chunks:
        return "\n\n" + "\n\n".join(context_chunks)
    return ""


# ─── Individual Provider Callers ─────────────────────────────────────────────

async def call_gemini_provider(
    api_key: str,
    message: str,
    system_prompt: str,
    chat_history: Optional[list[dict[str, str]]] = None,
) -> str:
    """Call Google Gemini Generative API with proper system instructions and alternating turns.
    Tries primary model first; if it fails with 404/503 or times out, falls back to next model.
    """
    # Model priority list: env-configured first, then stable fallbacks
    primary = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest").strip()
    fallback_models = [primary, "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3-flash-preview"]
    # Deduplicate while preserving order
    seen: set[str] = set()
    model_candidates: list[str] = []
    for m in fallback_models:
        if m not in seen:
            seen.add(m)
            model_candidates.append(m)

    contents = []
    if chat_history:
        for msg in chat_history[-8:]:
            r = msg.get("role", "")
            role = "user" if r == "user" else "model"
            text = msg.get("content", "").strip()
            if text:
                contents.append({"role": role, "parts": [{"text": text}]})

    contents.append({"role": "user", "parts": [{"text": message}]})

    payload = {
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048,
        },
    }

    last_error: Optional[LLMProviderError] = None

    for model_name in model_candidates:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key.strip()}"
        async with httpx.AsyncClient(timeout=45.0) as client:
            try:
                res = await client.post(url, json=payload)
            except httpx.TimeoutException:
                last_error = LLMProviderError(
                    f"Google Gemini ({model_name}) timed out. Retrying with next model...", 504, "gemini"
                )
                continue
            except Exception as exc:
                last_error = LLMProviderError(
                    f"Network error connecting to Gemini: {redact_secret(str(exc), api_key)}", 502, "gemini"
                )
                continue

        if res.status_code == 200:
            try:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and parts[0].get("text"):
                        return parts[0]["text"]
                raise LLMProviderError("Gemini returned empty candidate content.", 502, "gemini")
            except LLMProviderError:
                raise
            except Exception as exc:
                raise LLMProviderError(f"Failed to parse Gemini response: {str(exc)}", 502, "gemini") from exc

        err_msg = redact_secret(res.text[:300], api_key)
        if res.status_code in (400, 401, 403):
            raise LLMProviderError(
                f"Google Gemini authentication failed ({res.status_code}): Invalid or expired API key.", 401, "gemini"
            )
        if res.status_code == 429:
            raise LLMProviderError(
                "Google Gemini rate limit reached. Please wait a moment before sending another request.", 429, "gemini"
            )
        if res.status_code in (404, 503):
            # Model not found or overloaded — try next candidate
            last_error = LLMProviderError(
                f"Google Gemini model '{model_name}' unavailable ({res.status_code}). Trying next model...",
                res.status_code, "gemini"
            )
            continue
        raise LLMProviderError(f"Google Gemini error ({res.status_code}): {err_msg}", res.status_code, "gemini")

    # All models exhausted
    raise last_error or LLMProviderError("All configured Gemini models are currently unavailable.", 503, "gemini")


async def call_openai_compatible_provider(
    base_url: str,
    api_key: str,
    model: str,
    provider_name: str,
    message: str,
    system_prompt: str,
    chat_history: Optional[list[dict[str, str]]] = None,
) -> str:
    """Call OpenAI / Groq / OpenRouter API endpoints."""
    messages = [{"role": "system", "content": system_prompt}]

    if chat_history:
        for msg in chat_history[-8:]:
            role = "user" if msg.get("role") == "user" else "assistant"
            txt = msg.get("content", "").strip()
            if txt:
                messages.append({"role": role, "content": txt})

    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            res = await client.post(base_url, headers=headers, json=payload)
        except httpx.TimeoutException as exc:
            raise LLMProviderError(f"{provider_name} request timed out (25s).", 504, provider_name.lower()) from exc
        except Exception as exc:
            raise LLMProviderError(f"Network error connecting to {provider_name}: {redact_secret(str(exc), api_key)}", 502, provider_name.lower()) from exc

    if res.status_code != 200:
        err_msg = redact_secret(res.text[:300], api_key)
        if res.status_code in (401, 403):
            raise LLMProviderError(f"{provider_name} authentication failed ({res.status_code}): Invalid or expired API key.", 401, provider_name.lower())
        if res.status_code == 429:
            raise LLMProviderError(f"{provider_name} rate limit reached. Please wait a moment.", 429, provider_name.lower())
        raise LLMProviderError(f"{provider_name} error ({res.status_code}): {err_msg}", res.status_code, provider_name.lower())

    try:
        data = res.json()
        choices = data.get("choices", [])
        if choices:
            content = choices[0].get("message", {}).get("content")
            if content:
                return content
        raise LLMProviderError(f"{provider_name} returned empty choice content.", 502, provider_name.lower())
    except Exception as exc:
        if isinstance(exc, LLMProviderError):
            raise
        raise LLMProviderError(f"Failed to parse {provider_name} response: {str(exc)}", 502, provider_name.lower()) from exc


# ─── Unified AI Assistant Orchestrator ──────────────────────────────────────

async def get_ai_assistant_response(
    message: str,
    symbol: str,
    raw_history: Any,
    raw_quote: Optional[dict[str, Any]] = None,
    latest_analytics: Optional[dict[str, Any]] = None,
    client_api_key: Optional[str] = None,
    client_provider: Optional[str] = None,
    chat_history: Optional[list[dict[str, str]]] = None,
) -> dict[str, Any]:
    """
    Unified entry point for the QuantLab AI Assistant.
    - Accurately executes the selected LLM provider.
    - If a provider is configured and fails, reports the exact error (never hides it with a fallback).
    - If no LLM is configured, utilizes the modular, structured Offline Knowledge Engine.
    """
    clean_sym = symbol.split(":")[0].strip().upper() or "RELIANCE"
    tech = compute_live_technical_summary(clean_sym, raw_history, raw_quote)

    # 1. Resolve Provider and Key
    provider_choice = (client_provider or "auto").strip().lower()
    raw_key = (client_api_key or "").strip()

    gemini_key = ""
    groq_key = ""
    openai_key = ""

    if provider_choice == "gemini":
        gemini_key = raw_key or os.getenv("GEMINI_API_KEY", "")
    elif provider_choice == "groq":
        groq_key = raw_key or os.getenv("GROQ_API_KEY", "")
    elif provider_choice == "openai":
        openai_key = raw_key or os.getenv("OPENAI_API_KEY", "")
    elif provider_choice == "auto":
        if raw_key:
            if raw_key.startswith("AIza") or raw_key.startswith("AQ."):
                gemini_key = raw_key
            elif raw_key.startswith("gsk_"):
                groq_key = raw_key
            elif raw_key.startswith("sk-"):
                openai_key = raw_key
            else:
                gemini_key = raw_key  # default to Gemini if ambiguous
        else:
            gemini_key = os.getenv("GEMINI_API_KEY", "")
            groq_key = os.getenv("GROQ_API_KEY", "")
            openai_key = os.getenv("OPENAI_API_KEY", "")

    # Build system prompt with relevant context injection only
    context_str = build_context_prompt(message, clean_sym, tech, latest_analytics)
    effective_system_prompt = MASTER_SYSTEM_PROMPT + context_str

    # 2. Execute Configured LLM Provider
    # Rule: If an LLM provider was explicitly targeted or an API key was supplied, execute it.
    # If it fails, report clear provider error (Rule 6 & Test I).
    if gemini_key:
        try:
            text = await call_gemini_provider(gemini_key, message, effective_system_prompt, chat_history)
            return {
                "response": text,
                "technical_summary": tech if is_market_query(message, clean_sym) else None,
                "provider": "gemini",
                "is_offline": False,
            }
        except LLMProviderError as exc:
            return {
                "response": f"**Provider Error (Google Gemini)**: {exc.message}",
                "technical_summary": None,
                "provider": "gemini",
                "error": exc.message,
                "status": "error",
                "is_offline": False,
            }

    if groq_key:
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
        try:
            text = await call_openai_compatible_provider(
                "https://api.groq.com/openai/v1/chat/completions",
                groq_key,
                model,
                "Groq",
                message,
                effective_system_prompt,
                chat_history,
            )
            return {
                "response": text,
                "technical_summary": tech if is_market_query(message, clean_sym) else None,
                "provider": "groq",
                "is_offline": False,
            }
        except LLMProviderError as exc:
            return {
                "response": f"**Provider Error (Groq)**: {exc.message}",
                "technical_summary": None,
                "provider": "groq",
                "error": exc.message,
                "status": "error",
                "is_offline": False,
            }

    if openai_key:
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
        try:
            text = await call_openai_compatible_provider(
                "https://api.openai.com/v1/chat/completions",
                openai_key,
                model,
                "OpenAI",
                message,
                effective_system_prompt,
                chat_history,
            )
            return {
                "response": text,
                "technical_summary": tech if is_market_query(message, clean_sym) else None,
                "provider": "openai",
                "is_offline": False,
            }
        except LLMProviderError as exc:
            return {
                "response": f"**Provider Error (OpenAI)**: {exc.message}",
                "technical_summary": None,
                "provider": "openai",
                "error": exc.message,
                "status": "error",
                "is_offline": False,
            }

    # 3. If explicit provider chosen but no key found:
    if provider_choice in ("gemini", "groq", "openai") and not (gemini_key or groq_key or openai_key):
        provider_display = {"gemini": "Google Gemini", "groq": "Groq Cloud", "openai": "OpenAI"}.get(provider_choice, provider_choice)
        return {
            "response": f"**Configuration Notice**: **{provider_display}** was selected, but no API key was provided. "
                        f"Please set your API key in `backend/.env` (e.g. GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY) or use the built-in QuantLab Quantitative Engine.",
            "technical_summary": None,
            "provider": provider_choice,
            "error": "Missing API key for selected provider",
            "status": "error",
            "is_offline": False,
        }

    # 4. Offline Knowledge Engine Mode (No API Key Configured)
    offline_text = get_offline_response(
        query=message,
        symbol=clean_sym,
        tech=tech,
        latest_analytics=latest_analytics,
        chat_history=chat_history,
    )

    return {
        "response": offline_text,
        "technical_summary": tech if is_market_query(message, clean_sym) else None,
        "provider": "offline",
        "is_offline": True,
    }
