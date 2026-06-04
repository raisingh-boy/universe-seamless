import * as d3Force from "d3-force";
import { GraphData, GraphNode } from "./types";

export function runForceSimulation(
  data: GraphData,
  width: number,
  height: number
): GraphNode[] {
  const nodes: any[] = data.nodes.map((n) => ({ ...n }));
  const edges: Array<{source: string; target: string}> = data.edges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  // Calculate degree (number of connections) for each node
  const degreeMap: Record<string, number> = {};
  for (const n of nodes) degreeMap[(n as any).id] = 0;
  for (const e of edges) {
    const src: string = e.source as string;
    const tgt: string = e.target as string;
    if (degreeMap[src] !== undefined) degreeMap[src]++;
    if (degreeMap[tgt] !== undefined) degreeMap[tgt]++;
  }

  // Find max degree for normalization
  const maxDegree = Math.max(...Object.values(degreeMap), 1);

  // Group-based positioning: assign each group a Z-layer and X-Z offset
  const groupOrder = [
    "root", "dance", "somatic", "psychology", "psychedelic",
    "performance", "intersection", "linguistics", "ai"
  ];
  const groupZ: Record<string, number> = {};
  groupOrder.forEach((g, i) => {
    const angle = (i / groupOrder.length) * Math.PI * 2;
    groupZ[g] = Math.sin(angle) * 3;  // Z offset creates depth layers
  });

  // Attach degree and cluster info to nodes for the simulation
  for (const n of nodes) {
    n.degree = degreeMap[(n as any).id] || 0;
    n._groupIdx = groupOrder.indexOf(n.group);
    if (n._groupIdx === -1) n._groupIdx = groupOrder.length;
  }

  // Group centroid tracking for cluster gravity
  const groupCentroids: Record<string, { cx: number; cy: number; count: number }> = {};
  for (const n of nodes) {
    if (!groupCentroids[n.group]) groupCentroids[n.group] = { cx: 0, cy: 0, count: 0 };
    groupCentroids[n.group].count++;
  }

  const simulation = d3Force
    .forceSimulation(nodes)
    .force(
      "link",
      d3Force
        .forceLink(edges)
        .id((d: any) => d.id)
        .distance((d: any) => {
          // Connected hubs close together, leaves spread but still attached
          const srcDeg = degreeMap[typeof d.source === "string" ? d.source : d.source.id] || 1;
          const tgtDeg = degreeMap[typeof d.target === "string" ? d.target : d.target.id] || 1;
          const avgDeg = (srcDeg + tgtDeg) / 2;
          // Hubs (high degree): very close. Leaf-leaf connections: reasonable distance.
          // Range: hubs at ~8, leaf-leaf at ~25
          return Math.max(4, 18 - avgDeg * 0.4);
        })
        .strength((d: any) => {
          const srcDeg = degreeMap[typeof d.source === "string" ? d.source : d.source.id] || 1;
          const tgtDeg = degreeMap[typeof d.target === "string" ? d.target : d.target.id] || 1;
          const minDeg = Math.min(srcDeg, tgtDeg);
          // Stronger links for important connections
          return Math.min(0.8, 0.2 + minDeg * 0.05);
        })
    )
    .force("charge", d3Force.forceManyBody()
      .strength((d: any) => {
        // Even leaf nodes push apart moderately; hubs push hard
        const deg = degreeMap[d.id] || 1;
        return -(18 + deg * 2); // -30 to -100 depending on degree
      })
      .distanceMax(45) // Wider range for smoother layout
    )
    .force("collision", d3Force.forceCollide().radius((d: any) => {
      const deg = degreeMap[d.id] || 1;
      // Bigger collision radius for hubs
      return Math.max(2, 2 + (deg / maxDegree) * 8);
    }))
    .force("center", d3Force.forceCenter(0, 0).strength(0.1))
    .force("x", d3Force.forceX((d: any) => {
      // Tighter group clustering: spread groups in a circle
      const idx = groupOrder.indexOf(d.group);
      if (idx === -1) return 0;
      const angle = (idx / groupOrder.length) * Math.PI * 2;
      const radius = 10 + Math.sin(idx * 1.7 + 0.3) * 3;
      return Math.cos(angle) * radius;
    }).strength(0.25))
    .force("y", d3Force.forceY((d: any) => {
      const idx = groupOrder.indexOf(d.group);
      if (idx === -1) return 0;
      const angle = (idx / groupOrder.length) * Math.PI * 2;
      const radius = 10 + Math.sin(idx * 1.7 + 0.3) * 3;
      return Math.sin(angle) * radius;
    }).strength(0.25))
    .alphaDecay(0.015) // Slower decay = more iterations to settle
    .velocityDecay(0.3)
    .stop();

  // Run simulation — more iterations for better convergence
  const iterations = 2000;
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  // Add Z dimension: group-based depth layers + degree-based prominence
  const SCALE = 0.3;
  const groupZValues: Record<string, number> = {
    root: 0, intersection: 1, dance: 3, somatic: 2, psychology: 4,
    psychedelic: 5, performance: 4, linguistics: 5, ai: 5,
  };

  nodes.forEach((n: any) => {
    n.x *= SCALE;
    n.y *= SCALE;
    // Z: group layer + degree-based prominence
    const baseZ = groupZValues[n.group] || 3;
    const degNoise = (n.degree / maxDegree) * 2;
    const personalNoise = Math.sin(n.id.charCodeAt(0) * 7.3 + n.id.length * 3.1) * 1.5;
    n.z = (baseZ + personalNoise) * SCALE * 1;

    // Store degree for visual use
    n._degreeNorm = n.degree / maxDegree;
  });

  return nodes;
}
