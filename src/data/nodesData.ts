import { SomaticNode, SomaticLink, AudioItem, AgendaQuestion, ActivityNotification, Domain, World, NodeStatus, NodeType, Story, Article } from '../types';
import { NODES_PART1 } from './nodes-part1';
import { NODES_PART2 } from './nodes-part2';
import { NODES_PART3 } from './nodes-part3';
import { EDGES_PART1 } from './edges-part1';
import { EDGES_PART2 } from './edges-part2';
import { STORIES } from './stories';

// Combine node arrays
const rawNodes = [...NODES_PART1, ...NODES_PART2, ...NODES_PART3];

// Combine edge arrays
const rawEdges = [...EDGES_PART1, ...EDGES_PART2];

// Helper to map raw groups into typed Domains
const mapGroupToDomain = (group: string): Domain => {
  switch (group) {
    case 'root':
    case 'intersection':
      return 'hybrid';
    case 'dance':
    case 'performance':
    case 'arts':
      return 'movement';
    case 'somatic':
      return 'body';
    case 'psychology':
    case 'psychedelic':
    case 'concept':
      return 'philosophy';
    case 'linguistics':
      return 'cognition';
    case 'ai':
    case 'tech':
    case 'science':
    default:
      return 'science';
  }
};

const mapGroupToNodeType = (id: string, group: string): NodeType => {
  if (id === 'root') return 'concept';
  if (group === 'somatic') return 'practice';
  if (group === 'dance' || group === 'performance' || group === 'arts') return 'event';
  
  // Check for historical individuals
  const individuals = ['bateson', 'hanna', 'feldenkrais', 'alexander', 'rolf', 'cohen', 'paxton', 'graham', 'cunningham', 'chomsky', 'halprin', 'sheets-johnstone', 'forsythe', 'pauli', 'jung', 'bohm', 'varela'];
  if (individuals.some(name => id.toLowerCase().includes(name))) return 'person';
  
  if (group === 'movement' || id === 'yield') return 'movement';
  if (group === 'ai' || group === 'tech' || group === 'science' || group === 'linguistics') return 'concept';
  return 'concept';
};

const mapIdToLevel = (id: string): 'macro' | 'meso' | 'micro' => {
  const macros = new Set([
     'root', 'somatics', 'modern_dance', 'contact_improv', 'feldenkrais', 
     'alexander', 'cybernetics', 'neuroscience', 'philosophy', 'cognitive_sci', 
     'artificial_intelligence', 'linguistics', 'body_mind', 'rolfing', 
     'psychotherapy', 'psychedelic', 'performance_art'
  ]);
  const micros = new Set([
     'yield', 'point_of_support', 'shared_weight', 'rolling_point_of_contact', 
     'spiral_fall', 'headstand_to_roll', 'spinal_movement', 'breath'
  ]);
  if (macros.has(id)) return 'macro';
  if (micros.has(id)) return 'micro';
  return 'meso';
};

const getArticlesForNode = (nodeId: string): Article[] => {
  const list: Article[] = [];
  if (nodeId === 'root') {
    list.push({
      id: 'art-root-1',
      nodeId: 'root',
      titleRu: 'Соматика: Новые рубежи сознания и тела',
      titleEn: 'Somatics: New Frontiers of Somatic Movement',
      summaryRu: 'Классическое исследование Томаса Ханны о возникновении термина «соматика» и преодолении напряжения через мышечный перезапуск.',
      summaryEn: 'Thomas Hanna’s seminal exploration of somatic patterns and mind-body coordination.',
      sourceUrl: 'https://somatics.org/hanna-papers',
      sourceTitle: 'Somatic Journal',
      year: 1986,
      type: 'research'
    });
  }
  if (nodeId === 'contact_improv') {
    list.push({
      id: 'art-ci-1',
      nodeId: 'contact_improv',
      titleRu: 'Магниевый пик: рождение импровизации вздоха',
      titleEn: 'Magnesium Peak: Emergence of Contact Improvisation',
      summaryRu: 'Исторический разбор перформанса Magnesium в Оберлине в 1972 году, заложившего учение о физическом риске и падении.',
      summaryEn: 'An archival analysis of Steve Paxton’s Oberlin show that became the cradle of Contact Improvisation.',
      sourceUrl: 'https://contactquarterly.com',
      sourceTitle: 'Contact Quarterly',
      year: 1972,
      type: 'article'
    });
  }
  
  // general placeholder article if none:
  if (list.length === 0) {
    list.push({
      id: `art-gen-${nodeId}`,
      nodeId: nodeId,
      titleRu: `Исследование междисциплинарности: ${nodeId}`,
      titleEn: `Transdisciplinary review: ${nodeId}`,
      summaryRu: `Анализ связей узла ${nodeId} в контексте соматической интеграции учения о движении и феноменологии познания.`,
      summaryEn: `An in-depth contextual analysis of the node ${nodeId} within cognitive dynamics and performance pedagogy.`,
      sourceTitle: 'Unified Somatic Database Review',
      year: 2024,
      type: 'research'
    });
  }
  return list;
};

// Build the fully populated typed SomaticNode array of Atlas nodes
const ATLAS_NODES: SomaticNode[] = rawNodes.map((n: any) => {
  const domain = mapGroupToDomain(n.group);
  const type = mapGroupToNodeType(n.id, n.group);
  const level = mapIdToLevel(n.id);
  
  // All pre-loaded nodes are part of the verified Atlas system, thus highly resonant
  const resonances = 340;
  const status: NodeStatus = 'atlas';

  // Gather figures/years for authors and epochs
  const figuresStr = Array.isArray(n.figures) ? n.figures.join(', ') : (n.figures || '');
  const authorRu = figuresStr || undefined;
  const authorEn = figuresStr || undefined;
  const epochStr = n.years !== '-' ? n.years : undefined;
  const epochRu = epochStr;
  const epochEn = epochStr;

  const articles = getArticlesForNode(n.id);

  return {
    id: n.id,
    type,
    level,
    nameEn: n.label || n.id,
    nameRu: n.labelRu || n.descRu ? n.label || n.id : (n.label || n.id), // fallback gracefully
    domain,
    world: 'atlas',
    status,
    resonances,
    descriptionEn: n.desc || '',
    descriptionRu: n.descRu || n.desc || '',
    authorRu,
    authorEn,
    epochRu,
    epochEn,
    addedBy: undefined,
    connections: 25,
    carries: 12,
    score: resonances,
    articles
  };
});

// Configure beautifully seeded Field observations
export const FIELD_SEED_NODES: SomaticNode[] = [
  {
    id: 'field-seed-1',
    type: 'observation',
    level: 'meso',
    nameRu: 'Страх живёт в пояснице',
    nameEn: 'Fear lives in the lower back',
    domain: 'body',
    world: 'field',
    status: 'sprout',
    resonances: 23,
    connections: 3,
    carries: 5,
    score: 38,
    descriptionRu: 'Наблюдение практикующего: тревога и страх всегда находят своё место именно в поясничном отделе. Проверено на 40+ студентах.',
    descriptionEn: 'Practitioner observation: anxiety and fear consistently locate themselves in the lumbar region.',
    addedBy: 'Maya_CI',
    lastActiveAt: Date.now() - 86400000 * 2,
    articles: [
      {
        id: 'art-seed-1',
        nodeId: 'field-seed-1',
        titleRu: 'Пояснично-подвздошная мышка и стресс',
        titleEn: 'The Psoas Muscle and Emotional Stress',
        summaryRu: 'Клинический разбор физиологии страха и панциря в области поясницы.',
        summaryEn: 'Review of the Psoas muscle as the primary seat of physical fight-or-flight responses.',
        year: 2023,
        type: 'research'
      }
    ]
  },
  {
    id: 'field-seed-2',
    type: 'observation',
    level: 'meso',
    nameRu: 'Контакт как разговор без слов',
    nameEn: 'Contact as wordless conversation',
    domain: 'movement',
    world: 'field',
    status: 'alive',
    resonances: 67,
    connections: 8,
    carries: 12,
    score: 79,
    descriptionRu: 'В CI каждое касание — это вопрос и ответ одновременно. Тело знает язык который ум ещё не выучил.',
    descriptionEn: 'In CI every touch is simultaneously question and answer. The body knows a language the mind has not yet learned.',
    addedBy: 'Arjun_Move',
    lastActiveAt: Date.now() - 86400000,
    articles: [
      {
        id: 'art-seed-2',
        nodeId: 'field-seed-2',
        titleRu: 'Кинестетическая эмпатия в дуэтной импровизации',
        titleEn: 'Kinesthetic Empathy in Duet Interactions',
        summaryRu: 'Зеркальные нейроны и невербальная синхронизация партнеров в реальном времени.',
        summaryEn: 'Mirror neurons and real-time physical synchrony in kinetic systems.',
        year: 2021,
        type: 'research'
      }
    ]
  },
  {
    id: 'field-seed-3',
    type: 'observation',
    level: 'meso',
    nameRu: 'Пустота в движении как решение',
    nameEn: 'Emptiness in movement as solution',
    domain: 'philosophy',
    world: 'field',
    status: 'seed',
    resonances: 7,
    connections: 1,
    carries: 2,
    score: 8,
    descriptionRu: 'Когда перестаёшь искать следующее движение — оно приходит само. Пустота не отсутствие, а присутствие другого рода.',
    descriptionEn: 'When you stop searching for the next movement — it arrives by itself.',
    addedBy: 'Li_Wei',
    lastActiveAt: Date.now() - 86400000 * 5,
    articles: [
      {
        id: 'art-seed-3',
        nodeId: 'field-seed-3',
        titleRu: 'Даосское деяние и соматическое уступание',
        titleEn: 'Daoist non-action and somatic yielding',
        summaryRu: 'Философия у-вэй в практике современного танца и перформанса.',
        summaryEn: 'The philosophy of Wu-Wei implemented in active dance release techniques.',
        year: 2022,
        type: 'book'
      }
    ]
  },
];

// Initialize collective app nodes
export const INITIAL_NODES: SomaticNode[] = [...ATLAS_NODES, ...FIELD_SEED_NODES];

// Base links
const base_links: SomaticLink[] = rawEdges.map((edge: any, index: number) => {
  // Try to define a beautiful type
  let type: 'conceptual' | 'historical' | 'practical' | 'resonance' | 'opposition' = 'practical';
  if (edge[0] === 'root' || edge[1] === 'root') type = 'conceptual';
  else if (edge[2]?.toLowerCase().includes('истори') || edge[2]?.toLowerCase().includes('основа') || edge[2]?.toLowerCase().includes('ученик')) {
    type = 'historical';
  } else if (edge[2]?.toLowerCase().includes('против') || edge[2]?.toLowerCase().includes('оппоз')) {
    type = 'opposition';
  }

  return {
    id: `lnk-${index}`,
    source: edge[0],
    target: edge[1],
    type,
    world: 'atlas',
    labelRu: edge[2] || 'Направление смысловой связи',
    labelEn: edge[0].toUpperCase() + ' connects to ' + edge[1].toUpperCase(),
    resonanceWeight: 5,
    activity: 4 + Math.floor(Math.random() * 6),
    storyIds: [],
    createdAt: Date.now() - 30 * 86400000
  };
});

// Build ALL_STORIES and match storyIds directly on links
export const ALL_STORIES: Story[] = STORIES.map((story: any) => {
  // Try to find matching edge
  const f1 = story.figure1 ? story.figure1.toLowerCase() : '';
  const f2 = story.figure2 ? story.figure2.toLowerCase() : '';

  let matchingLink = base_links.find(lnk => {
    const s = lnk.source.toLowerCase();
    const t = lnk.target.toLowerCase();
    return (s.includes(f1) && t.includes(f2)) || (s.includes(f2) && t.includes(f1)) ||
           (f1.includes(s) && f2.includes(t)) || (f1.includes(t) && f2.includes(s));
  });

  let edgeId = '';
  if (matchingLink) {
    edgeId = matchingLink.id;
  } else {
    // dynamically establish a historical field edge if story doesn't fit existing ones
    // resolving f1 and f2 to actual nodes or defaulting to known concepts
    const sourceNode = INITIAL_NODES.find(n => n.id.toLowerCase().includes(f1) || f1.includes(n.id.toLowerCase()))?.id || 'root';
    const targetNode = INITIAL_NODES.find(n => n.id.toLowerCase().includes(f2) || f2.includes(n.id.toLowerCase()))?.id || 'somatics';
    
    // Check if dynamic link already exists
    const dynId = `lnk-dyn-${story.id}`;
    edgeId = dynId;
    
    base_links.push({
      id: dynId,
      source: sourceNode,
      target: targetNode,
      type: 'historical',
      world: 'atlas',
      labelRu: story.title,
      labelEn: story.title,
      resonanceWeight: 6,
      activity: 8,
      storyIds: [],
      createdAt: Date.now() - 15 * 86400000
    });
  }

  // Push storyId to the target link
  const linkToUpdate = base_links.find(l => l.id === edgeId);
  if (linkToUpdate) {
    if (!linkToUpdate.storyIds) linkToUpdate.storyIds = [];
    linkToUpdate.storyIds.push(story.id);
  }

  return {
    id: story.id,
    edgeId,
    titleRu: story.title,
    titleEn: story.title,
    textRu: story.summaryRu || story.summary || '',
    textEn: story.summary || '',
    figureA: story.figure1,
    figureB: story.figure2,
    year: story.year || undefined,
    sourceUrl: 'https://somatics.org/library',
    resonances: 24 + Math.floor(Math.random() * 45),
    verified: true
  };
});

// Finalize initialized link array
export const INITIAL_LINKS: SomaticLink[] = base_links;

// Configure beautifully synced sample audios referencing active node ids
export const SAMPLE_AUDIO: AudioItem[] = [
  {
    id: 'aud-ecology',
    titleRu: 'Экологический Разум и Соматические Синергии',
    titleEn: 'Gregory Bateson and Somatic Synergies',
    authorRu: 'Лекция: Проф. Григорий Шевелев',
    authorEn: 'Lecture: Prof. Gregory Shevelev',
    sourceRu: 'Конференция Мэйси 2026',
    sourceEn: 'Macy Conference 2026',
    year: 2026,
    duration: 180,
    domain: 'philosophy',
    timelineNodes: [
      { timeMs: 5000, nodeId: 'bateson', captionRu: 'Грегори Бейтсон: Паттерн, который соединяет жизнь.', captionEn: 'Gregory Bateson: The pattern that connects.' },
      { timeMs: 40000, nodeId: 'cybernetics', captionRu: 'Кибернетические циклы обратной связи.', captionEn: 'Cybernetic loops and system feedback.' },
      { timeMs: 90000, nodeId: 'somatics', captionRu: 'Тело как живой энактивированный софт ума.', captionEn: 'Body as live enacted software of the mind.' },
      { timeMs: 140000, nodeId: 'proprioception', captionRu: 'Проприоцепция как вечная нить обратной связи.', captionEn: 'Proprioception as biological feedback link.' }
    ]
  },
  {
    id: 'aud-contact',
    titleRu: 'Стив Пэкстон: Свобода Падения и Вес Гравитации',
    titleEn: 'Steve Paxton: Freedom of Fall and the Weight of Gravity',
    authorRu: 'Хореограф: Мария Степанова',
    authorEn: 'Choreographer: Mary Stepanova',
    sourceRu: 'Лаборатория Жизнь/Искусство',
    sourceEn: 'Life/Art Lab Sessions',
    year: 2025,
    duration: 220,
    domain: 'movement',
    timelineNodes: [
      { timeMs: 10000, nodeId: 'contact_improv', captionRu: 'Рождение контактной импровизации из веса Magnesium 1972.', captionEn: 'Emergence of contact improvisation in 1972.' },
      { timeMs: 60000, nodeId: 'steve_paxton', captionRu: 'Стив Пэкстон и его уроки уступания гравитации.', captionEn: 'Steve Paxton coaching weight-yielding loops.' },
      { timeMs: 120000, nodeId: 'feldenkrais', captionRu: 'Метод Фельденкрайза как перепрограммирование походки.', captionEn: 'Feldenkrais Method rewiring motor patterns.' },
      { timeMs: 170000, nodeId: 'biomechanics', captionRu: 'Суставная биомеханика во время падений.', captionEn: 'Joint biomechanics in safe falls.' }
    ]
  }
];

// Configure dynamic agendas
export const SAMPLE_AGENDA: AgendaQuestion[] = [
  {
    id: 'ag-q1',
    questionRu: 'Может ли заземление унять семантическую тревогу?',
    questionEn: 'Can grounding dissolve semantic anxiety?',
    domains: ['body', 'philosophy', 'cognition'],
    contributorsCount: 14,
    contributors: [
      { name: 'Elena_S', avatar: 'E' },
      { name: 'SomaticDev', avatar: 'S' },
      { name: 'ZenFlow', avatar: 'Z' }
    ],
    answers: [
      {
        id: 'ag-a1',
        author: 'Elena_S',
        textRu: 'Абсолютно. Вся семантическая тревога укоренена в петлях ума. Сброс веса в [Проприоцепцию] отключает префронтальное сужение внимания.',
        textEn: 'Absolutely. All semantic anxiety is looped in abstract mind coordinates. Releasing weight to [Proprioception] disarms prefrontal focus.'
      }
    ]
  }
];

// Configure starting activity notifications
export const INITIAL_NOTIFICATIONS: ActivityNotification[] = [
  {
    id: 'not-init-1',
    timestamp: '14:20:10',
    textRu: 'База данных успешно перестроена на 170 соматических узлов и 376 связей.',
    textEn: 'Database successfully recalibrated to 170 somatic nodes and 376 links.'
  },
  {
    id: 'not-init-2',
    timestamp: '13:05:42',
    textRu: 'Нода [Embodied AI] добавлена в Поле смыслов от SomaticPioneer.',
    textEn: 'Node [Embodied AI] unseeded in the Field of Meaning by SomaticPioneer.'
  }
];
