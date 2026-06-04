# 🌌 SEAMLESS — 3D Interactive Knowledge Universe

> React Three Fiber force-directed graph mapping ~149 nodes and ~344 connections across dance, somatics, psychology, psychedelics, performance, linguistics, and AI.

🌐 **Live**: [universe.seameless.club](https://universe.seameless.club)

## What is this?

An interactive 3D knowledge graph where every node is a historical figure, discipline, or concept, and every edge is a documented real-world connection ("who met whom, when, where, why").

Think: *Dance meets neuroscience meets psychedelics meets AI.*

## Tech Stack

- **React Three Fiber** — 3D WebGL rendering (mobile-first)
- **Three.js** (r175) + **@react-three/drei** (10.7)
- **d3-force** — force-directed graph layout
- **TypeScript** + **Vite**

## Project Structure

```
src/
  components/
    Scene.tsx         — Main 3D scene (canvas, nodes, edges, force layout)
    MindMap.tsx       — SVG mini-mind-map inside info panel (radial tree)
    StoryCard.tsx     — Expandable "Did you know…?" story card
    ErrorBoundary.tsx — React error boundary for graceful fallbacks
    Node.tsx          — 3D node component
    Edge.tsx          — 3D edge/connection line component
    Graph.tsx         — Graph container
    CameraController.tsx
  data/
    somatic-complex.json — THE data file (149 nodes, 344 edges, 66 stories)
  utils/
    forceLayout.ts     — d3-force simulation wrapper
```

## Data Format

`somatic-complex.json` contains:

```json
{
  "nodes": [
    {
      "id": "unique_id",
      "label": "Readable Name",
      "group": "dance|somatic|psychology|psychedelic|performance|linguistics|ai|intersection|root",
      "desc": "English description",
      "descRu": "Russian description",
      "years": "1872–1952",
      "figures": ["Key Figure 1"],
      "events": ["Key event"],
      "influences": ["Influence"]
    }
  ],
  "edges": [
    {
      "source": "node_id_1",
      "target": "node_id_2",
      "desc": "Who met whom, when, where — English",
      "descRu": "Russian version"
    }
  ],
  "stories": [
    {
      "title": "Story Title",
      "figure1": "Person A",
      "figure2": "Person B",
      "year": "1933",
      "summary": "What happened",
      "summaryRu": "Russian version",
      "context": "Broader context",
      "contextRu": "Russian context",
      "spheres": ["dance", "somatic"]
    }
  ]
}
```

## Running Locally

```bash
git clone https://github.com/raisingh-boy/universe-seamless.git
cd universe-seamless
npm install
npm run dev     # → http://localhost:5173

# Production build
npm run build
npx vite preview --host 0.0.0.0 --port 5183
```

## Mobile Features

- **Bottom sheet** info panel (iOS-style)
- **Mind Map** tab: radial SVG showing all connections (tap to navigate)
- **Stories** tab: expandable "Did you know…?" cards with full text
- **Serif font** (Georgia) for long-form reading
- **Position: fixed** panel — always on top of 3D scene
- **Error boundary** with visible fallback state

## Key Design Decisions

- **Single source of truth**: `somatic-complex.json` — one file for all data
- **Mobile-first**: iPhone-compatible WebGL, no pure black screen
- **Russian/English**: All descriptions have both languages
- **Every edge is a real story**: No theoretical/abstract connections
- **Force sim before render**: d3-force clusters nodes before first frame

## Adding Data

1. Edit `src/data/somatic-complex.json`
2. Add nodes (with `descRu` for Russian)
3. Add edges with narrative `desc`/`descRu`
4. Add stories with `summary`/`summaryRu`
5. Rebuild: `npm run build && npx vite preview --host 0.0.0.0 --port 5183`

## License

MIT — use freely, fork, remix.

---

*Built for the SEAMLESS Movement Research Project — tracing the hidden connections between body, mind, and cosmos.*
