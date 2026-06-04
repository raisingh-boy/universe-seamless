#!/usr/bin/env python3
"""Translate English desc/summary/context fields to Russian and add descRu/summaryRu/contextRu."""
import json
import time
from deep_translator import GoogleTranslator

INFILE = "/root/.openclaw/workspace/semantic-journey/src/data/somatic-complex.json"

translator = GoogleTranslator(source="en", target="ru")

def translate(text, label=""):
    """Translate text to Russian with retry."""
    if not text or not text.strip():
        return text
    for attempt in range(3):
        try:
            result = translator.translate(text)
            time.sleep(0.3)  # rate limit
            return result
        except Exception as e:
            print(f"  Retry {attempt+1} for {label}: {e}")
            time.sleep(2)
    print(f"  FAILED to translate: {label}")
    return text  # fallback to original

def main():
    with open(INFILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # --- Nodes ---
    nodes = data.get("nodes", [])
    print(f"Translating {len(nodes)} nodes...")
    for i, n in enumerate(nodes):
        desc = n.get("desc", "")
        if desc and "descRu" not in n:
            ru = translate(desc, f"node {n['id']} ({i+1}/{len(nodes)})")
            n["descRu"] = ru
            if (i+1) % 10 == 0:
                print(f"  {i+1}/{len(nodes)} nodes done")

    # --- Stories ---
    stories = data.get("stories", [])
    print(f"\nTranslating {len(stories)} stories...")
    for i, s in enumerate(stories):
        sid = s.get("id", f"story_{i}")
        summary = s.get("summary", "")
        context = s.get("context", "")
        if summary and "summaryRu" not in s:
            s["summaryRu"] = translate(summary, f"summary {sid}")
        if context and "contextRu" not in s:
            s["contextRu"] = translate(context, f"context {sid}")
        if (i+1) % 5 == 0:
            print(f"  {i+1}/{len(stories)} stories done")

    # --- Write back ---
    with open(INFILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\nWritten to {INFILE}")
    
    # --- Verification ---
    with open(INFILE, "r", encoding="utf-8") as f:
        vd = json.load(f)
    st = vd.get("stories", [])
    sr = sum(1 for s in st if s.get("summaryRu"))
    nd = vd.get("nodes", [])
    nr = sum(1 for n in nd if n.get("descRu"))
    ed = vd.get("edges", [])
    er = sum(1 for e in ed if e.get("descRu"))
    print(f"\nVERIFICATION:")
    print(f"  Nodes: {nr}/{len(nd)} have descRu")
    print(f"  Edges: {er}/{len(ed)} have descRu")
    print(f"  Stories: {sr}/{len(st)} have summaryRu")

if __name__ == "__main__":
    main()
