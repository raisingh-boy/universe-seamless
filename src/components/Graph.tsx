import React, { useMemo } from "react";
import { GraphData, GraphNode } from "../utils/types";
import { runForceSimulation } from "../utils/forceLayout";
import NodeSphere from "./Node";
import EdgeLine from "./Edge";

interface GraphProps {
  data: GraphData;
}

const ERA_COLORS = ["#d4a857", "#2a9d8f", "#e76f51", "#6b4c7a", "#457b9d"];

const Graph: React.FC<GraphProps> = ({ data }) => {
  const layout = useMemo(() => {
    return runForceSimulation(data, 30, 30);
  }, [data]);

  // Build lookup
  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    layout.forEach((n) => m.set(n.id, n));
    return m;
  }, [layout]);

  // Color nodes by group
  const groupColors = useMemo(() => {
    const groups = [...new Set(data.nodes.map((n) => n.group))];
    const cm = new Map<string, string>();
    groups.forEach((g, i) => cm.set(g, ERA_COLORS[i % ERA_COLORS.length]));
    return cm;
  }, [data]);

  return (
    <>
      {/* Connections */}
      {data.edges.map((e, i) => {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) return null;
        // Determine color from target's group
        const targetNode = data.nodes.find((n) => n.id === e.target);
        const color = groupColors.get(targetNode?.group || "figure") || "#d4a857";
        return (
          <EdgeLine
            key={`edge-${i}`}
            edge={e}
            source={s}
            target={t}
            color={color}
          />
        );
      })}

      {/* Nodes */}
      {layout.map((n) => {
        const orig = data.nodes.find((on) => on.id === n.id);
        const color = groupColors.get(orig?.group || "figure") || "#d4a857";
        return (
          <NodeSphere key={n.id} node={n} color={color} />
        );
      })}
    </>
  );
};

export default Graph;
