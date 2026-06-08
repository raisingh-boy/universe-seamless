import React, { useState } from 'react';
import { SomaticNode, Domain } from '../types';
import { 
  X, Sparkles, Brain, Link2, Check, ArrowRight,
  BookOpen, Plus, Network, HelpCircle, Activity
} from 'lucide-react';

interface AddSenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  allNodes: SomaticNode[];
  language: 'ru' | 'en';
  onAddObservation: (obs: { name: string; text: string; domain: Domain; linkToId?: string; isPrivate?: boolean }) => void;
  onAddConnection: (conn: { sourceId: string; targetId: string; text: string }) => void;
  onAddAgendaQuestion: (q: { text: string; domains: Domain[] }) => void;
  onAddGlobalStory: (story: { nodeId: string; text: string }) => void;
}

export default function AddSenseModal({
  isOpen,
  onClose,
  allNodes,
  language,
  onAddObservation,
  onAddConnection,
  onAddAgendaQuestion,
  onAddGlobalStory
}: AddSenseModalProps) {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedResult, setParsedResult] = useState<{
    type: 'connection' | 'node' | 'story' | 'unknown';
    title: string;
    description: string;
    domain?: Domain;
    sourceId?: string;
    targetId?: string;
    nodeId?: string;
    confidence: number;
  } | null>(null);

  const [isAscending, setIsAscending] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  if (!isOpen && !showNotification) return null;

  // Simple, powerful deterministic parsing rules acting as "Generative Somatic AI Engine"
  const handleAnalyze = () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);

    setTimeout(() => {
      const text = inputText.toLowerCase().trim();
      
      // Rule 1: CONNECT/LINK/СВЯЗАТЬ (Linking existing nodes)
      const isConnection = text.includes('связать') || text.includes('соединить') || text.includes('connect') || text.includes('link') || text.includes(' ⟷ ') || text.includes(' - ');
      
      // Try to find two matched nodes in the user's text
      let matchedNodes: SomaticNode[] = [];
      for (const node of allNodes) {
        const nameRu = (node.nameRu || '').toLowerCase();
        const nameEn = (node.nameEn || '').toLowerCase();
        
        if (text.includes(nameRu) || text.includes(nameEn) || 
            (node.id && text.includes(node.id.toLowerCase()))) {
          matchedNodes.push(node);
        }
      }
      
      // De-duplicate matched nodes by ID
      const uniqueMatched = Array.from(new Map(matchedNodes.map(item => [item.id, item])).values());

      // Rule 2: NARRATIVE / STORY / ИСТОРИЯ
      const isStory = text.includes('истори') || text.includes('story') || text.includes('narrat') || text.includes('практик') || text.includes('опыт') || text.includes('заметк');

      if (isConnection && uniqueMatched.length >= 2) {
        const sNode = uniqueMatched[0];
        const tNode = uniqueMatched[1];
        setParsedResult({
          type: 'connection',
          title: language === 'ru' ? 'Сплетение соматического моста (Ребро Смыслов)' : 'Somatic Lattice Bridge Embryo',
          description: language === 'ru' 
            ? `Связь между: "${sNode.nameRu}" и "${tNode.nameRu}"`
            : `Somatic link between: "${sNode.nameEn}" and "${tNode.nameEn}"`,
          sourceId: sNode.id,
          targetId: tNode.id,
          confidence: 96
        });
      } else if (uniqueMatched.length === 1 && isStory) {
        const targetNode = uniqueMatched[0];
        // Clean out node name and trigger words to leave pure narrative text
        let cleanText = inputText;
        const triggerWords = ['история', 'story', 'для', 'for', targetNode.nameRu, targetNode.nameEn, 'заметка', 'занести'];
        triggerWords.forEach(word => {
          if (word) {
            const regex = new RegExp(word, 'gi');
            cleanText = cleanText.replace(regex, '');
          }
        });
        cleanText = cleanText.replace(/[:.,]/g, '').trim();
        if (!cleanText) {
          cleanText = language === 'ru' 
            ? 'Проходя сквозь заземление опор, почувствовал импульс вытяжения.' 
            : 'Felt deep axial length expansion rooting down the sitbones.';
        }

        setParsedResult({
          type: 'story',
          title: language === 'ru' ? `Новый нарратив для: ${targetNode.nameRu}` : `Narrative thread for: ${targetNode.nameEn}`,
          description: cleanText,
          nodeId: targetNode.id,
          confidence: 88
        });
      } else {
        // Default Rule: Create a beautiful new Mind-Spore (SomaticNode)
        // Detect domain tags or fallback to 'body'
        let detectedDomain: Domain = 'body';
        if (text.includes('#science') || text.includes('#наука') || text.includes('физик') || text.includes('исследован')) {
          detectedDomain = 'science';
        } else if (text.includes('#philosophy') || text.includes('#философ') || text.includes('разум') || text.includes('мысл')) {
          detectedDomain = 'philosophy';
        } else if (text.includes('#movement') || text.includes('#практик') || text.includes('движен') || text.includes('танец')) {
          detectedDomain = 'movement';
        } else if (text.includes('#cognition') || text.includes('#язык') || text.includes('когниция') || text.includes('слово')) {
          detectedDomain = 'cognition';
        } else if (text.includes('#hybrid') || text.includes('#гибрид') || text.includes('пересечен')) {
          detectedDomain = 'hybrid';
        }

        // Clean text of hashtags for the name
        let cleanName = inputText.replace(/#[a-zA-Zа-яА-Я0-9]+/g, '').trim();
        if (cleanName.length > 50) {
          cleanName = cleanName.substring(0, 47) + '...';
        }
        if (!cleanName) {
          cleanName = language === 'ru' ? 'Новое соматическое озарение' : 'Intuitive Somatic Synthesis';
        }

        setParsedResult({
          type: 'node',
          title: language === 'ru' ? `Новый концепт-роксток: "${cleanName}"` : `New Somatic Embyonic Node: "${cleanName}"`,
          description: inputText,
          domain: detectedDomain,
          confidence: 82
        });
      }
      setIsAnalyzing(false);
    }, 1200); // Simulated quantum parsing latency
  };

  const handleConfirm = () => {
    if (!parsedResult) return;
    setIsAscending(true);

    setTimeout(() => {
      // Execute the parsed result creation callbacks in global state!
      if (parsedResult.type === 'connection' && parsedResult.sourceId && parsedResult.targetId) {
        onAddConnection({
          sourceId: parsedResult.sourceId,
          targetId: parsedResult.targetId,
          text: language === 'ru' ? 'Связь установлена ИИ' : 'AI generated organic linkage'
        });
      } else if (parsedResult.type === 'story' && parsedResult.nodeId) {
        onAddGlobalStory({
          nodeId: parsedResult.nodeId,
          text: parsedResult.description
        });
      } else if (parsedResult.type === 'node') {
        onAddObservation({
          name: parsedResult.title.replace(/New Somatic Embyonic Node: |Новый концепт-роксток: /g, '').replace(/"/g, ''),
          text: parsedResult.description,
          domain: parsedResult.domain || 'body',
          isPrivate: false
        });
      }

      setIsAscending(false);
      setShowNotification(true);
      setParsedResult(null);
      setInputText('');

      setTimeout(() => {
        setShowNotification(false);
        onClose();
      }, 2500);
    }, 1500); // Beautiful ascension delay
  };

  const handleSuggestionClick = (text: string) => {
    setInputText(text);
    setParsedResult(null);
  };

  const ruSuggestions = [
    'Связать Томас Ханна и Экология ума',
    'Осознавание через движение: Телесное внимание восстанавливает нейропластичность #philosophy',
    'История для Вегетативная нервная система: При глубоком выдохе в таз сразу замедлился пульс'
  ];

  const enSuggestions = [
    'Connect Somatosensory Cortex and Body Schema',
    'Dynamic breathing loops restore diaphragm elasticity and core support #movement',
    'Story for Feldenkrais: Muscle tone immediately normalized when imagining horizontal pelvic circles'
  ];

  const suggestions = language === 'ru' ? ruSuggestions : enSuggestions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      
      {/* SUCCESS FLYING ASCENSION STATE OVERLAY */}
      {showNotification && (
        <div className="absolute inset-0 bg-[#050811]/90 flex flex-col items-center justify-center text-center p-6 z-50">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 animate-pulse">
            <Check className="w-10 h-10 animate-bounce" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
            {language === 'ru' ? 'МЫСЛЬ ВОСПАРЯЕТ!' : 'MEANING EMITS!'}
          </h2>
          <p className="text-sm text-gray-400 font-mono max-w-sm">
            {language === 'ru' 
              ? 'Ваш инсайт успешно синтезирован, занесен в нейронный граф и направлен на эволюцию в реальном времени.' 
              : 'Quantum organic structure compiled in database. Your light insight is morphing the universe.'}
          </p>
        </div>
      )}

      {/* CORE INPUT CONTAINER */}
      <div className="w-full max-w-xl bg-[#090D1A]/95 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon and Bio */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 uppercase tracking-widest font-bold">
                SOMATIC AI ENGINE v3
              </span>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-white mt-0.5">
              {language === 'ru' ? 'Единый Поток Мысли' : 'Single Stream Mind Map Catalyst'}
            </h3>
          </div>
        </div>

        {/* Information Callout */}
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          {language === 'ru' 
            ? 'Забудьте о многошаговых формах! Просто напишите мысль своими словами. ИИ автоматически определит, хотите ли вы создать новый Смысл, протянуть Связующую нить или оставить Личный нарратив к ноде.' 
            : 'Unleash direct raw insight. Simply write: our AI engine deciphers whether to spawn a new Organic Concept, bridge Somatic connections, or archive an interactive Narrative thread.'}
        </p>

        {/* Suggested Prompts Grid */}
        <div className="mb-5 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold block">
            {language === 'ru' ? 'КЛИКНИТЕ ДЛЯ ПРИМЕРА ИНТУИТИВНОЙ КОРРЕКЦИИ:' : 'CLICK FOR QUICK FORMAT INSIGHT TEMPLATES:'}
          </span>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestionClick(sug)}
                className="p-2 bg-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/30 text-left text-[11px] text-gray-300 rounded-xl border border-white/5 cursor-pointer transition-all active:scale-95 truncate"
                title={sug}
              >
                💡 "{sug}"
              </button>
            ))}
          </div>
        </div>

        {/* Input Text Form Area */}
        <div className="space-y-4">
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (parsedResult) setParsedResult(null);
              }}
              placeholder={language === 'ru' ? 'Пример: Связать "Томас Ханна" и "Движение" \nили: Интеграция осанки через центрирование #science' : 'Example: Connect "Body Schema" and "Proprioception" \nor: Grounding is key factor to spine decompresion #movement'}
              rows={4}
              className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-400 transition-all resize-none custom-scrollbar"
              required
            />
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText('')}
                className="absolute bottom-4 right-4 text-xs font-mono text-gray-500 hover:text-white uppercase"
              >
                {language === 'ru' ? 'Сброс' : 'Clear'}
              </button>
            )}
          </div>

          {/* PARSED PREVIEW ZONE */}
          {isAnalyzing && (
            <div className="bg-[#0C1221] border border-white/5 p-4 rounded-2xl flex items-center justify-center gap-3 animate-pulse">
              <Activity className="w-5 h-5 text-[#DFB757] animate-spin" />
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                {language === 'ru' ? 'ИИ Считывает соматический спектр...' : 'QUANTUM DECODING CHRONICLE COGNITION...'}
              </span>
            </div>
          )}

          {parsedResult && !isAnalyzing && (
            <div className="bg-[#0C1221] border border-white/10 p-4 rounded-2xl space-y-3 animate-fade-in text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#DFB757] font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {language === 'ru' ? 'РЕЗУЛЬТАТ АВТОМАШИННОГО ЧТЕНИЯ:' : 'GENERATIVE AI SYNTACTIC PARSE:'}
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] text-[#DFB757] font-bold font-mono">
                  {parsedResult.confidence}% CONFIDENCE
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="text-xs flex items-center gap-2 font-bold text-white">
                  {parsedResult.type === 'node' && <Plus className="w-3.5 h-3.5 text-emerald-400" />}
                  {parsedResult.type === 'connection' && <Link2 className="w-3.5 h-3.5 text-indigo-400" />}
                  {parsedResult.type === 'story' && <BookOpen className="w-3.5 h-3.5 text-purple-400" />}
                  {parsedResult.title}
                </div>
                <p className="text-xs text-gray-400 tracking-tight leading-relaxed">
                  {parsedResult.description}
                </p>
                {parsedResult.domain && (
                  <div className="pt-2">
                    <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-mono tracking-wider text-indigo-300 uppercase">
                      DOMAIN: {parsedResult.domain}
                    </span>
                  </div>
                )}
              </div>

              {/* Action commands confirmation */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isAscending}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-[#DFB757] text-white hover:opacity-90 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isAscending ? (
                    <>
                      <Network className="w-4 h-4 animate-spin" />
                      {language === 'ru' ? 'ПЕРЕДАЧА...' : 'EMITTING BIOMASS...'}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {language === 'ru' ? 'ЗАПУСТИТЬ ОРГАНИЧЕСКИЙ СИНТЕЗ' : 'CONFIRM EMBRYO & ASCEND'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Static analysis catalyst button */}
          {!parsedResult && !isAnalyzing && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!inputText.trim()}
              className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 active:scale-98 text-white rounded-2xl text-xs font-extrabold tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xl"
            >
              <Sparkles className="w-4 h-4 text-[#DFB757]" />
              {language === 'ru' ? 'ДЕКОДИРОВАТЬ ИСКУССТВЕННЫМ ИНТЕЛЛЕКТОМ' : 'DECODE INSIGHT & CATALYZE REALMS'}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
