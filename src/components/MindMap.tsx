import { useMemo } from 'react';

interface MMNode { id: string; label: string; group: string; }
interface MMEdge { source: string; target: string; desc: string; descRu: string; }

interface MindMapProps {
  centerNode: any;
  allNodes: MMNode[];
  edges: MMEdge[];
  onNodeSelect: (id: string) => void;
  lang: 'en' | 'ru';
}

const COLORS: Record<string,string> = {
  root: "#d4a857", dance: "#a8d8ea", somatic: "#88d8b0",
  performance: "#f4a261", psychology: "#e76f51",
  psychedelic: "#b583df", linguistics: "#6b705c",
  ai: "#457b9d", intersection: "#a5a58d",
};

export default function MindMap({ centerNode, allNodes, edges, onNodeSelect, lang }: MindMapProps) {
  const centerColor = COLORS[centerNode.group] || "#ffffff";

  // Find all directly connected nodes
  const connected = useMemo(() => {
    const result: { node: MMNode; edge: MMEdge; angle: number }[] = [];
    const centerId = centerNode.id;

    edges.forEach(e => {
      let connectedId: string | null = null;
      if (e.source === centerId) connectedId = e.target;
      else if (e.target === centerId) connectedId = e.source;

      if (connectedId) {
        const node = allNodes.find(n => n.id === connectedId);
        if (node) {
          result.push({ node, edge: e, angle: 0 });
        }
      }
    });

    // Sort alphabetically, then assign even angles
    result.sort((a, b) => a.node.label.localeCompare(b.node.label));
    const total = result.length;
    result.forEach((r, i) => {
      r.angle = (i / total) * 2 * Math.PI - Math.PI / 2;
    });

    return result;
  }, [centerNode, allNodes, edges]);

  // Use media query width: the panel is ~94vw on mobile
  const svgW = 320;
  const svgH = 280;
  const mmapCenter = { x: 160, y: 130 };
  const RADIUS = 80;

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        color: `${centerColor}aa`,
        fontSize: 8, letterSpacing: 1.5,
        textTransform: 'uppercase', margin: '4px 0 2px',
      }}>
        {lang === 'ru'
          ? `СВЯЗИ ${centerNode.label.toUpperCase()} — ${connected.length}`
          : `${centerNode.label.toUpperCase()} CONNECTIONS — ${connected.length}`}
      </div>

      {/* SVG Diagram */}
      <div style={{
        borderRadius: 10, marginBottom: 8,
        background: 'rgba(255,255,240,0.01)',
        border: '1px solid rgba(255,255,240,0.06)',
        overflow: 'hidden',
      }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Lines */}
          {connected.map((c) => {
            const x2 = mmapCenter.x + RADIUS * Math.cos(c.angle);
            const y2 = mmapCenter.y + RADIUS * Math.sin(c.angle);
            const cColor = COLORS[c.node.group] || "#ffffff";
            return (
              <line
                key={c.node.id}
                x1={mmapCenter.x} y1={mmapCenter.y}
                x2={x2} y2={y2}
                stroke={`${cColor}33`}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            );
          })}

          {/* Center glow */}
          <circle cx={mmapCenter.x} cy={mmapCenter.y} r={28}
            fill={`${centerColor}08`} stroke="none" />
          {/* Center node */}
          <circle cx={mmapCenter.x} cy={mmapCenter.y} r={16}
            fill={`${centerColor}22`} stroke={centerColor} strokeWidth={1.5} />
          <text x={mmapCenter.x} y={mmapCenter.y + 1}
            textAnchor="middle" dominantBaseline="central"
            fill="rgba(255,255,240,0.6)" fontSize={7}
            style={{ pointerEvents: 'none', fontFamily: 'Inter, sans-serif' }}>
            {centerNode.label.substring(0, 12)}
          </text>

          {/* Connected nodes */}
          {connected.map((c) => {
            const x = mmapCenter.x + RADIUS * Math.cos(c.angle);
            const y = mmapCenter.y + RADIUS * Math.sin(c.angle);
            const cColor = COLORS[c.node.group] || "#ffffff";
            const label = c.node.label;

            return (
              <g key={c.node.id} style={{ cursor: 'pointer' }}
                onClick={() => onNodeSelect(c.node.id)}>
                <circle cx={x} cy={y} r={12}
                  fill={`${cColor}18`} stroke={`${cColor}66`} strokeWidth={1} />
                <text x={x} y={y + 4}
                  textAnchor="middle" dominantBaseline="central"
                  fill="rgba(255,255,240,0.6)" fontSize={5.5}
                  style={{ pointerEvents: 'none', fontFamily: 'Inter, sans-serif' }}>
                  {label.length > 14 ? label.substring(0, 12) + '…' : label}
                </text>
                {/* Small group indicator dot */}
                <circle cx={x + 10} cy={y - 10} r={2}
                  fill={cColor} opacity={0.5} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Connection list */}
      <div style={{
        borderRadius: 10,
        background: 'rgba(255,255,240,0.02)',
        border: '1px solid rgba(255,255,240,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '8px 10px' }}>
          <div style={{
            color: `${centerColor}77`, fontSize: 8, letterSpacing: 1.5,
            textTransform: 'uppercase', marginBottom: 6,
          }}>
            {lang === 'ru' ? 'НАЖМИ НА УЗЕЛ ЧТОБЫ ПЕРЕЙТИ' : 'TAP A NODE TO NAVIGATE'}
          </div>
          <div>
            {connected.map(c => {
              const cColor = COLORS[c.node.group] || "#ffffff";
              const desc = lang === 'ru' ? (c.edge.descRu || c.edge.desc) : (c.edge.desc || c.edge.descRu);
              const groupName = lang === 'ru'
                ? ({ root: 'Корень', dance: 'Танец', somatic: 'Соматика', performance: 'Перформанс',
                    psychology: 'Психология', psychedelic: 'Психоделика', linguistics: 'Лингвистика',
                    ai: 'ИИ', intersection: 'Стык' }[c.node.group] || c.node.group)
                : c.node.group;
              return (
                <div key={c.node.id} onClick={() => onNodeSelect(c.node.id)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '6px 6px', borderRadius: 6, cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,240,0.04)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${cColor}08`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: cColor, flexShrink: 0, marginTop: 4,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                      <span style={{ color: 'rgba(255,255,240,0.75)', fontSize: 10, fontWeight: 600 }}>
                        {c.node.label}
                      </span>
                      <span style={{
                        color: `${cColor}66`, fontSize: 7, letterSpacing: 0.5,
                        background: `${cColor}11`, borderRadius: 3, padding: '1px 5px',
                      }}>{groupName}</span>
                    </div>
                    {desc && <div style={{ color: 'rgba(255,255,240,0.25)', fontSize: 8, lineHeight: 1.4, fontFamily: "'Georgia', 'Noto Serif', serif" }}>
                      {desc.length > 130 ? desc.substring(0, 130) + '…' : desc}
                    </div>}
                  </div>
                  <div style={{ color: 'rgba(255,255,240,0.15)', fontSize: 10, marginTop: 2 }}>→</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
