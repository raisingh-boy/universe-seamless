import type { KnowledgeGraph } from "./graph-data";

/**
 * Extract knowledge graph from text using pattern matching.
 * For production: replace with actual LLM API call.
 */
export function extractGraph(text: string): KnowledgeGraph {
  const nodes: KnowledgeGraph["nodes"] = [];
  const edges: KnowledgeGraph["edges"] = [];
  const seen = new Set<string>();

  // Simple keyword extraction (demo — LLM would do this better)
  const lines = text.split("\n").filter(l => l.trim());
  let currentModule = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Module detection (words in ALL CAPS)
    const capsMatch = trimmed.match(/^([A-Z]{2,})/);
    if (capsMatch) {
      const id = capsMatch[1].toLowerCase();
      if (!seen.has(id)) {
        nodes.push({ id, label: capsMatch[1], group: "module" });
        seen.add(id);
      }
      currentModule = id;
      continue;
    }

    // Concept detection (Capitalized short phrases)
    const conceptMatch = trimmed.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})/);
    if (conceptMatch && currentModule) {
      const id = conceptMatch[1].toLowerCase().replace(/\s+/g, "-");
      if (!seen.has(id)) {
        nodes.push({ id, label: conceptMatch[1], group: "concept" });
        seen.add(id);
        edges.push({ source: currentModule, target: id });
      }
    }
  }

  return { nodes, edges };
}
