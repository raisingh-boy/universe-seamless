export type Domain = 'body' | 'philosophy' | 'movement' | 'science' | 'cognition' | 'hybrid';

export type World = 'atlas' | 'field' | 'me';

export type NodeStatus = 'seed' | 'sprout' | 'alive' | 'rooted' | 'atlas';

export type NodeType = 'concept' | 'practice' | 'person' | 'movement' | 'event' | 'observation' | 'question';

export interface Story {
  id: string;
  edgeId: string;              // к какому ребру привязана (ОБЯЗАТЕЛЬНО)
  titleRu: string;
  titleEn: string;
  textRu: string;
  textEn: string;
  figureA?: string;            // первый участник пересечения
  figureB?: string;            // второй участник
  year?: number;               // когда произошло
  sourceUrl?: string;          // ссылка на источник
  authorId?: string;           // кто написал (для пользовательских историй)
  resonances: number;          // голосование за историю
  verified: boolean;           // верифицирована командой
}

export interface Article {
  id: string;
  nodeId: string;              // к какой ноде привязана
  titleRu: string;
  titleEn: string;
  summaryRu: string;           // выжимка 3-5 предложений
  summaryEn: string;
  sourceUrl?: string;          // ссылка на оригинал
  sourceTitle?: string;        // название источника
  year?: number;
  type: 'research' | 'article' | 'book' | 'video';
  addedBy?: string;            // команда или пользователь
}

export interface SomaticNode {
  id: string;
  nameRu: string;
  nameEn: string;
  type: NodeType;
  level: 'macro' | 'meso' | 'micro';
  domain: Domain;
  world: World;
  status: NodeStatus;
  resonances: number;
  descriptionRu: string;
  descriptionEn: string;
  authorRu?: string;
  authorEn?: string;
  epochRu?: string; // e.g., "1960s", "Antiquity"
  epochEn?: string;
  addedBy?: string;
  isPrivate?: boolean;
  connections?: number;   // how many times a connection was made with this node
  carries?: number;       // how many times a node was pocketed
  score?: number;         // computed evolution score
  lastActiveAt?: number;  // last custom interaction timestamp
  articles?: Article[];
  
  // Physics parameters (assigned dynamically if needed)
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  targetX?: number; // target coordinates during animations / transitions
  targetY?: number;
  targetZ?: number;
  currentRadius?: number;
  baseRadius?: number;
  breathPhase?: number;
  breathSpeed?: number;
}

export type EdgeType = 'conceptual' | 'historical' | 'practical' | 'resonance' | 'opposition';

export interface SomaticLink {
  id: string;
  source: string; // source node id
  target: string; // target node id
  type: EdgeType;
  world: 'atlas' | 'field';
  labelRu?: string;
  labelEn?: string;
  resonanceWeight: number; // strength of link
  activity: number;        // activity score (influences particles)
  addedBy?: string;        // кто добавил (для field рёбер)
  storyIds?: string[];     // истории привязанные к ЭТОМУ РЕБРУ
  createdAt?: number;
}

export interface PulseParticle {
  progress: number;
  speed: number;
  opacity: number;
  color: string;
}

export interface AudioItem {
  id: string;
  titleRu: string;
  titleEn: string;
  authorRu: string;
  authorEn: string;
  sourceRu: string;
  sourceEn: string;
  year: number;
  duration: number; // in seconds
  audioUrl?: string; // placeholder or sample
  domain: Domain;
  timelineNodes: {
    timeMs: number;
    nodeId: string;
    captionRu: string;
    captionEn: string;
  }[];
}

export interface AgendaQuestion {
  id: string;
  questionRu: string;
  questionEn: string;
  domains: Domain[];
  contributorsCount: number;
  contributors: { name: string; avatar: string }[];
  answers: {
    id: string;
    author: string;
    textRu: string;
    textEn: string;
    linkedNodeId?: string;
    linkedNodeNameRu?: string;
    linkedNodeNameEn?: string;
    linkedNodeNameEn_temp?: string; // fallback if needed
  }[];
}

export interface ActivityNotification {
  id: string;
  timestamp: string;
  textRu: string;
  textEn: string;
}

export interface UserProfile {
  name: string;
  domains: Domain[];
  sensesAdded: number;
  storiesWritten: number;
  nodesMovedToAtlas: number;
  archetypes: {
    connector: boolean;   // many connections created
    storyteller: boolean; // many stories added
    resonator: boolean;   // lots of resonances
    pioneer: boolean;     // has nodes ascended to Atlas
    bridge: boolean;      // links multiple domains
  };
  privacySettings: {
    myGraph: 'public' | 'overlayOnly' | 'private';
    myResonances: 'visible' | 'hidden';
  };
}

export interface CommunityUser {
  id: string;
  name: string;
  avatar: string;
  dominantDomain: Domain;
  reputation: number;
  explorer: number;
  builder: number;
  connector: number;
  storyteller: number;
  resonances: string[];
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

