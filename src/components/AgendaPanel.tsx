import React, { useState } from 'react';
import { AgendaQuestion, SomaticNode, Domain } from '../types';
import { HelpCircle, ChevronDown, ChevronUp, MessageSquare, Plus, User, Link2, Check } from 'lucide-react';

interface AgendaPanelProps {
  questions: AgendaQuestion[];
  allNodes: SomaticNode[];
  language: 'ru' | 'en';
  onSelectNode: (node: SomaticNode) => void;
  onAddAnswerToQuestion: (qId: string, answerText: string, linkedNodeId?: string) => void;
}

const DOMAIN_BORDER_COLORS: Record<Domain, string> = {
  body: 'border-[#E8A95C]/30 text-[#E8A95C]',
  science: 'border-[#5C9BE8]/30 text-[#5C9BE8]',
  philosophy: 'border-[#9B5CE8]/30 text-[#9B5CE8]',
  movement: 'border-[#5CE87A]/30 text-[#5CE87A]',
  cognition: 'border-white/20 text-white',
  hybrid: 'border-[#E85C7A]/30 text-[#E85C7A]'
};

export default function AgendaPanel({
  questions,
  allNodes,
  language,
  onSelectNode,
  onAddAnswerToQuestion
}: AgendaPanelProps) {
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>('q1'); // Open first by default
  const [showAnswerFormForId, setShowAnswerFormForId] = useState<string | null>(null);
  const [newAnswerText, setNewAnswerText] = useState<string>('');
  const [selectedLinkedNodeId, setSelectedLinkedNodeId] = useState<string>('');
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  const handleSubToggle = (id: string) => {
    setExpandedQuestionId(expandedQuestionId === id ? null : id);
    setShowAnswerFormForId(null);
    setHasSubmitted(false);
  };

  const handleAnswerSubmit = (e: React.FormEvent, qId: string) => {
    e.preventDefault();
    if (!newAnswerText.trim()) return;

    onAddAnswerToQuestion(qId, newAnswerText.trim(), selectedLinkedNodeId || undefined);
    
    setHasSubmitted(true);
    setNewAnswerText('');
    setSelectedLinkedNodeId('');
    
    setTimeout(() => {
      setShowAnswerFormForId(null);
      setHasSubmitted(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in text-left select-none text-gray-200">
      
      {/* Page Title */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-white tracking-tight font-sans">
          {language === 'ru' ? 'ПОВЕСТКА СООБЩЕСТВА' : 'COMMUNITY AGENDAS'}
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          {language === 'ru' 
            ? 'Живые соматические вопросы. Сообщество ищет скрытые пересечения через практику.' 
            : 'Unsolved somatic inquiries. Connect conceptual pathways through physical experiences.'}
        </p>
      </div>

      {/* Questions list container */}
      <div className="space-y-4">
        {questions.map((q) => {
          const isExpanded = expandedQuestionId === q.id;
          
          return (
            <div 
              key={q.id}
              className={`bg-[#0C111C]/70 border rounded-2xl transition-all duration-300 overflow-hidden ${
                isExpanded ? 'border-indigo-500/25 shadow-xl shadow-indigo-950/20' : 'border-white/5 hover:border-white/12'
              }`}
            >
              
              {/* Question Header Card */}
              <div 
                onClick={() => handleSubToggle(q.id)}
                className="p-5 flex justify-between items-start gap-4 cursor-pointer hover:bg-white/5 transition-all text-left"
              >
                <div className="space-y-2.5 flex-1">
                  {/* Category tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {q.domains.map(dom => (
                      <span 
                        key={dom}
                        className={`text-[9px] font-mono border px-2 py-0.5 rounded-full capitalize ${DOMAIN_BORDER_COLORS[dom]}`}
                      >
                        {dom}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                    {language === 'ru' ? q.questionRu : q.questionEn}
                  </h3>

                  {/* Contributor initial circles */}
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-gray-400">
                    <div className="flex -space-x-2">
                      {q.contributors.map((c, i) => (
                        <div 
                          key={i}
                          className="w-5 h-5 rounded-full bg-slate-800 border-2 border-[#090D15] flex items-center justify-center font-bold text-[8px] text-[#DFB757]"
                          title={c.name}
                        >
                          {c.avatar}
                        </div>
                      ))}
                    </div>
                    <span>
                      {q.contributorsCount} {language === 'ru' ? 'исследователей ведут тему' : 'investigators active'}
                    </span>
                  </div>
                </div>

                <div className="p-1 px-2 bg-white/5 rounded-lg text-gray-400 hover:text-white mt-1">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Collapsible content (Answers loop) */}
              {isExpanded && (
                <div className="border-t border-white/5 bg-[#080C14]/60 p-5 pt-4 space-y-4 animate-slide-in">
                  
                  {/* Subtitle */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                    <span>{language === 'ru' ? 'ОТВЕТЫ И НАБЛЮДЕНИЯ:' : 'RESPONSES & OBSERVATIONS:'}</span>
                    <button
                      onClick={() => setShowAnswerFormForId(showAnswerFormForId === q.id ? null : q.id)}
                      className="text-indigo-400 hover:text-white flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {language === 'ru' ? 'Добавить наблюдение' : 'Contribute View'}
                    </button>
                  </div>

                  {/* Answer proposal form block */}
                  {showAnswerFormForId === q.id && (
                    <form 
                      onSubmit={(e) => handleAnswerSubmit(e, q.id)}
                      className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col gap-3 animate-fade-in text-xs"
                    >
                      {hasSubmitted ? (
                        <div className="py-4 text-center text-emerald-400 flex flex-col items-center gap-2">
                          <Check className="w-6 h-6 shrink-0" />
                          <p>{language === 'ru' ? 'Ответ добавлен в Повестку!' : 'Response added successfully!'}</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="text-[10px] font-mono text-[#DFB757] uppercase block mb-1">
                              {language === 'ru' ? 'ОТВЕТ ИЗ ТЕЛЕСНОЙ ПРАКТИКИ:' : 'SOMATIC PRACTICE ARGUMENT:'}
                            </label>
                            <textarea
                              value={newAnswerText}
                              onChange={(e) => setNewAnswerText(e.target.value)}
                              placeholder={language === 'ru' ? 'Я вижу это через...' : 'I observe this via my movement...'}
                              rows={3}
                              className="w-full bg-[#06090F] border border-white/10 p-2 rounded-lg text-white focus:outline-none focus:border-[#DFB757]"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-mono text-[#DFB757] uppercase block mb-1">
                              {language === 'ru' ? 'ПРИВЯЗАТЬ НОДУ К ТЕКСТУ (ОПЦИОНАЛЬНО):' : 'LINK PERTINENT CONCEPT CELL (OPTIONAL):'}
                            </label>
                            <select
                              value={selectedLinkedNodeId}
                              onChange={(e) => setSelectedLinkedNodeId(e.target.value)}
                              className="w-full bg-[#06090F] border border-white/10 p-2 rounded-lg text-white focus:outline-none"
                            >
                              <option value="">{language === 'ru' ? '-- Выберите ноду --' : '-- Choose target node --'}</option>
                              {allNodes.map(n => (
                                <option key={n.id} value={n.id}>{language === 'ru' ? n.nameRu : n.nameEn}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex justify-end gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowAnswerFormForId(null)}
                              className="text-gray-400 hover:text-white px-2 py-1"
                            >
                              {language === 'ru' ? 'Отмена' : 'Cancel'}
                            </button>
                            <button
                              type="submit"
                              className="px-3 bg-indigo-500 hover:bg-indigo-600 rounded text-white font-bold transition-all active:scale-95"
                            >
                              {language === 'ru' ? 'Сохранить' : 'Post'}
                            </button>
                          </div>
                        </>
                      )}
                    </form>
                  )}

                  {/* Answers loop content */}
                  <div className="space-y-3">
                    {q.answers.map((ans) => {
                      return (
                        <div key={ans.id} className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-2">
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                            <User className="w-3.5 h-3.5 text-indigo-400" />
                            <span>@{ans.author}</span>
                          </div>

                          <p className="text-xs text-gray-300 leading-relaxed font-sans font-medium">
                            {ans.textRu}
                          </p>

                          {/* Interactive node reference button inside response */}
                          {ans.linkedNodeId && (
                            <button
                              onClick={() => {
                                const target = allNodes.find(n => n.id === ans.linkedNodeId);
                                if (target) onSelectNode(target);
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/25 hover:border-indigo-500/50 text-[#DFB757] hover:text-white text-[9px] font-mono rounded-lg transition-all cursor-pointer"
                            >
                              <Link2 className="w-3 h-3 text-indigo-400" />
                              <span>{language === 'ru' ? ans.linkedNodeNameRu : ans.linkedNodeNameEn}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {q.answers.length === 0 && (
                      <p className="text-xs text-gray-500 font-mono italic p-4 text-center">
                        {language === 'ru' ? 'Наблюдений еще нет. Будьте первым!' : 'No entries contributed yet. Initiate the response map!'}
                      </p>
                    )}
                  </div>

                </div>
              )}

            </div>
          );
        })}
      </div>

    </div>
  );
}
