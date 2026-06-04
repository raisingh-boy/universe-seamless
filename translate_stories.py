#!/usr/bin/env python3
"""Translate intersection stories in somatic-complex.json to Russian via DeepSeek API"""
import json, requests, sys, time, re

DEEPSEEK_KEY = "sk-bee63ec9340144cfa518a4970d09a022"
MODEL = "deepseek-v4-flash"
DATA_FILE = "src/data/somatic-complex.json"

def translate_batch(items, field_name):
    """Translate a batch of text items to Russian"""
    results = [None] * len(items)
    # Group into chunks of 5
    chunk_size = 5
    for chunk_start in range(0, len(items), chunk_size):
        chunk = items[chunk_start:chunk_start+chunk_size]
        chunk_lines = []
        for i, item in enumerate(chunk):
            chunk_lines.append(f"[{i}] {item}")
        
        text = "\n\n".join(chunk_lines)
        prompt = f"""Translate the following {len(chunk)} texts to Russian. Return ONLY a JSON object where keys are the original indices (as integers in string format) and values are the Russian translations. No explanations, no extra text.

Input:
{text}"""
        
        for attempt in range(3):
            try:
                resp = requests.post(
                    "https://api.deepseek.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {DEEPSEEK_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": MODEL,
                        "messages": [
                            {"role": "system", "content": "You are a precise translator. Return ONLY valid JSON matching the requested format. No markdown."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1,
                        "max_tokens": 4000,
                    },
                    timeout=60
                )
                if resp.status_code != 200:
                    print(f"  API error: {resp.status_code} {resp.text[:100]}")
                    time.sleep(3)
                    continue
                
                content = resp.json()["choices"][0]["message"]["content"]
                # Strip markdown code blocks if present
                content = re.sub(r'```(?:json)?\s*', '', content).strip()
                
                translations = json.loads(content)
                for i, item in enumerate(chunk):
                    idx_str = str(i)
                    if idx_str in translations:
                        results[chunk_start + i] = translations[idx_str]
                    else:
                        print(f"  MISSING index {i} in response")
                        results[chunk_start + i] = item  # fallback to original
                break
            except Exception as e:
                print(f"  Attempt {attempt+1} failed: {e}")
                time.sleep(5)
        else:
            # All attempts failed - use original text
            for i in range(len(chunk)):
                results[chunk_start + i] = chunk[i]
            print(f"  FAILED after 3 attempts, using originals")
        
        print(f"  Translated {chunk_start+len(chunk)}/{len(items)}...")
        time.sleep(1)
    
    return results

def main():
    with open(DATA_FILE) as f:
        data = json.load(f)
    
    stories = data.get("stories", [])
    print(f"Found {len(stories)} stories to translate")
    
    if not stories:
        print("No stories found!")
        return
    
    # Collect texts to translate
    titles = []
    summaries = []
    contexts = []
    
    for s in stories:
        titles.append(s.get("title", ""))
        summaries.append(s.get("summary", ""))
        contexts.append(s.get("context", ""))
    
    # Translate titles
    if any(t for t in titles):
        print(f"\nTranslating {len(titles)} titles...")
        title_ru = translate_batch(titles, "title")
        for i, s in enumerate(stories):
            s["titleRu"] = title_ru[i]
    
    # Translate summaries
    if any(s for s in summaries):
        print(f"\nTranslating {len(summaries)} summaries...")
        summary_ru = translate_batch(summaries, "summary")
        for i, s in enumerate(stories):
            s["summaryRu"] = summary_ru[i]
    
    # Translate contexts
    if any(c for c in contexts):
        print(f"\nTranslating {len(contexts)} contexts...")
        context_ru = translate_batch(contexts, "context")
        for i, s in enumerate(stories):
            s["contextRu"] = context_ru[i]
    
    # Save
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Saved {DATA_FILE}")
    
    # Verify
    with open(DATA_FILE) as f:
        data2 = json.load(f)
    ru_count = sum(1 for s in data2.get("stories", []) if s.get("titleRu"))
    print(f"Stories with titleRu: {ru_count}/{len(stories)}")

if __name__ == "__main__":
    main()
