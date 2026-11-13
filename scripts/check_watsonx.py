"""Live watsonx smoke test. Run once .env is filled: .venv/bin/python scripts/check_watsonx.py

Prints variable names only, never values.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from warmintro.config import get_settings  # noqa: E402
from warmintro.llm import WatsonxLLM  # noqa: E402

CONTEXT = '<context>\n{"task": "vote"}\n</context>'


def main() -> int:
    s = get_settings()
    names = {
        "WATSONX_APIKEY": s.watsonx_api_key,
        "WATSONX_URL": s.watsonx_url,
        "WATSONX_PROJECT_ID": s.watsonx_project_id,
        "WATSONX_CHAT_MODEL": s.watsonx_chat_model_id,
        "WATSONX_EMBED_MODEL": s.watsonx_embedding_model_id,
    }
    for name, value in names.items():
        print(f"{name}: {'set' if value else 'NOT SET'}")
    try:
        llm = WatsonxLLM()
        a, b = llm.embed(["drone mapping for farms", "aerial crop surveys"])
        dot = sum(x * y for x, y in zip(a, b, strict=True))
        cos = dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))
        print(f"embed: dimension {len(a)}, cosine {cos:.3f}")
        reply = llm.chat("You are a concise assistant.", [{"role": "user", "content": "Say hello in one sentence."}])
        print(f"chat: {reply[:200]}")
        system = (
            'You are a member deciding on an introduction. Reply only with JSON: {"vote": "yes" | "no", "reason": "one sentence"}.'
            f"\n{CONTEXT}"
        )
        raw = llm.chat(system, [{"role": "user", "content": "We offer drone surveys; you need crop data."}], json_mode=True)
        try:
            json.loads(raw)
            print("json_mode: reply parsed as JSON")
        except json.JSONDecodeError:
            print(f"json_mode: reply did NOT parse as JSON: {raw[:200]}")
            return 1
    except Exception as exc:  # report any failure as one clear line
        print(f"FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
