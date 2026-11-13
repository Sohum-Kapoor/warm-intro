"""Run from anywhere: python3 site/data/build_dev_fallback.py. Builds site/data/dev_fallback.js from committed runs/demo.json and data/profiles.json."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
members = json.loads((root / 'data/profiles.json').read_text())['members']
demo = json.loads((root / 'runs/demo.json').read_text())
fb = {
    "synthetic": True, "ai_generated": True, "generated_at": None,
    "provider": None, "chat_model": None, "embed_model": None,
    "members": members, "demo_run": demo, "network_run": demo,
    "asks": [], "learning": {},
}
js = ("// Development fallback built from runs/demo.json and data/profiles.json. Synthetic data.\n"
      "// Also supplies full member profiles (deal-breakers, budgets, permissions) to the page.\n"
      "window.WARM_INTRO_FALLBACK = " + json.dumps(fb, separators=(',', ':')) + ";\n"
      "if (!window.WARM_INTRO) { window.WARM_INTRO = window.WARM_INTRO_FALLBACK; window.WARM_INTRO_IS_FALLBACK = true; }\n")
(root / 'site/data/dev_fallback.js').write_text(js)
print(len(js))
