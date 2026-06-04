export interface GraphNode {
  id: string;
  label: string;
  group?: string;
  description?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const seamlessGraph: KnowledgeGraph = {
  nodes: [
    { id: "seamless", label: "SEAMLESS", group: "core", description: "1 month · 5 workshops · 60+ hours" },
    { id: "yield", label: "YIELD", group: "module", description: "falling & flow" },
    { id: "surrender", label: "Surrender", group: "concept", description: "Letting go of control, trusting the body's intelligence" },
    { id: "transitions", label: "Transitions", group: "concept", description: "How one fall becomes the beginning of the next movement" },
    { id: "flow", label: "Flow State", group: "concept", description: "Continuous movement without conscious effort" },
    { id: "nexus", label: "NEXUS", group: "module", description: "liftings in dynamics" },
    { id: "dynamics", label: "Dynamics", group: "concept", description: "The interplay of forces between two moving bodies" },
    { id: "balance", label: "Balance", group: "concept", description: "Finding center in motion, alone and together" },
    { id: "weight", label: "Weight Sharing", group: "concept", description: "Distributing mass through contact points" },
    { id: "revive", label: "REVIVE", group: "module", description: "partnering & choreo" },
    { id: "choreo", label: "Choreography", group: "concept", description: "Composing movement in real time with a partner" },
    { id: "connection", label: "Connection", group: "concept", description: "Deep listening through touch and shared weight" },
    { id: "presence", label: "Presence", group: "concept", description: "Full awareness in the moment of contact" },
    { id: "soar", label: "SOAR", group: "module", description: "flying & soft acro" },
    { id: "lift", label: "Lifting", group: "concept", description: "Supporting partner weight through structural alignment" },
    { id: "blossom", label: "BLOSSOM", group: "module", description: "basic skills for beginners" },
    { id: "trust", label: "Trust", group: "foundation", description: "The foundation of all partner work" },
    { id: "listening", label: "Listening", group: "foundation", description: "Receiving information through tactile awareness" },
  ],
  edges: [
    { source: "seamless", target: "yield" },
    { source: "seamless", target: "nexus" },
    { source: "seamless", target: "revive" },
    { source: "seamless", target: "soar" },
    { source: "seamless", target: "blossom" },
    { source: "yield", target: "surrender" },
    { source: "yield", target: "transitions" },
    { source: "yield", target: "flow" },
    { source: "nexus", target: "dynamics" },
    { source: "nexus", target: "balance" },
    { source: "nexus", target: "weight" },
    { source: "revive", target: "choreo" },
    { source: "revive", target: "connection" },
    { source: "revive", target: "presence" },
    { source: "soar", target: "lift" },
    { source: "soar", target: "trust" },
    { source: "blossom", target: "trust" },
    { source: "blossom", target: "listening" },
    { source: "trust", target: "surrender" },
    { source: "listening", target: "connection" },
    { source: "flow", target: "dynamics" },
    { source: "balance", target: "weight" },
    { source: "choreo", target: "presence" },
  ],
};
