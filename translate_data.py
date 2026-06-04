#!/usr/bin/env python3
"""Translate all English content in somatic-complex.json to Russian using DeepSeek API."""
import json, os, sys, time

DS_KEY = os.environ.get('DEEPSEEK_KEY') or "sk-bee6e7f6682442dfa9b3ff42409f6ab3"

JSON_PATH = "/root/.openclaw/workspace/semantic-journey/src/data/somatic-complex.json"
API_URL = "https://api.deepseek.com/v1/chat/completions"

def load_data():
    with open(JSON_PATH) as f:
        return json.load(f)

def save_data(data):
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved to {JSON_PATH}")

def translate_batch(texts, batch_size=5):
    """Translate a batch of texts using DeepSeek API."""
    results = {}
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        batch_prompt = "Translate the following texts from English to Russian. Keep proper names and book/work titles in original. Return translations as numbered list:\n\n"
        for j, (key, text) in enumerate(batch):
            batch_prompt += f"{j+1}. {text[:300]}\n"
        
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": batch_prompt}],
            "temperature": 0.3,
            "max_tokens": 4096
        }
        
        for attempt in range(3):
            try:
                r = requests.post(API_URL, json=payload, headers={
                    "Authorization": f"Bearer {DS_KEY}",
                    "Content-Type": "application/json"
                }, timeout=60)
                if r.status_code == 200:
                    content = r.json()['choices'][0]['message']['content']
                    lines = content.strip().split('\n')
                    for j, (key, _) in enumerate(batch):
                        if j < len(lines):
                            # Extract translation after the number
                            line = lines[j].strip()
                            if '.' in line[:4]:
                                translation = line.split('.', 1)[1].strip()
                            else:
                                translation = line
                            results[key] = translation
                    print(f"  Batch {i//batch_size+1}/{len(range(0,len(texts),batch_size))}: OK")
                    break
                else:
                    print(f"  API error: {r.status_code} {r.text[:200]}")
                    time.sleep(2)
            except Exception as e:
                print(f"  Attempt {attempt+1} failed: {e}")
                time.sleep(2)
        time.sleep(0.5)
    return results

if __name__ == '__main__':
    import requests
    data = load_data()
    
    # 1. Translate node descriptions
    print("=== Translating node descriptions ===")
    nodes = data.get('nodes', [])
    descs = [(n['id'], n.get('desc', '')) for n in nodes if n.get('desc') and 'descRu' not in n]
    print(f"Total: {len(descs)}")
    translated = translate_batch(descs)
    for node in nodes:
        if node['id'] in translated:
            node['descRu'] = translated[node['id']]
    
    # 2. Translate edge descriptions
    print("\n=== Translating edge descriptions ===")
    edges = data.get('edges', [])
    edescs = [(f"{e['source']}→{e['target']}", e.get('desc', '')) for e in edges if e.get('desc') and 'descRu' not in e]
    print(f"Total: {len(edescs)}")
    translated_e = translate_batch(edescs)
    for e in edges:
        key = f"{e['source']}→{e['target']}"
        if key in translated_e:
            e['descRu'] = translated_e[key]
    
    # 3. Translate story summaries and contexts
    print("\n=== Translating story summaries ===")
    stories = data.get('stories', [])
    summaries = [(s.get('title', s.get('id', f'story_{i}')), s.get('summary', '')) for i, s in enumerate(stories) if s.get('summary') and 'summaryRu' not in s]
    print(f"Total: {len(summaries)}")
    translated_s = translate_batch(summaries)
    for s in stories:
        key = s.get('title', s.get('id', ''))
        if key in translated_s:
            s['summaryRu'] = translated_s[key]
    
    print("\n=== Translating story contexts ===")
    contexts = [(s.get('title', s.get('id', f'story_{i}')), s.get('context', '')) for i, s in enumerate(stories) if s.get('context') and 'contextRu' not in s]
    print(f"Total: {len(contexts)}")
    translated_c = translate_batch(contexts)
    for s in stories:
        key = s.get('title', s.get('id', ''))
        if key in translated_c:
            s['contextRu'] = translated_c[key]
    
    save_data(data)
    
    # Verify
    ru_s = sum(1 for s in stories if s.get('summaryRu'))
    ru_n = sum(1 for n in nodes if n.get('descRu'))
    ru_e = sum(1 for e in edges if e.get('descRu'))
    print(f"\n✅ Done: {ru_n}/{len(nodes)} nodes, {ru_e}/{len(edges)} edges, {ru_s}/{len(stories)} stories")
