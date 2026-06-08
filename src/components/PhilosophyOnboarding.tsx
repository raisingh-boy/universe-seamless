import React, { useState } from 'react';
import { ChevronDown, ArrowRight, Layers, Eye, BookOpen } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
  language: 'ru' | 'en';
  onToggleLanguage: () => void; // ADDED
}

export default function PhilosophyOnboarding({ onComplete, language, onToggleLanguage }: OnboardingProps) {
  const [slide, setSlide] = useState<number>(1);

  return (
    <div className="fixed inset-0 bg-[#04060A] text-gray-200 z-50 flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* Background organic light rays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-amber-500/5 blur-[120px]" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* Top utility row */}
      <div className="p-6 flex justify-between items-center z-10">
        <span className="text-[10px] font-mono tracking-[0.25em] text-gray-400">
          SEAMLESS UNIVERSE // ONBOARDING
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLanguage}
            className="w-10 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-mono font-bold text-white cursor-pointer transition-all flex items-center justify-center font-bold"
          >
            {language === 'ru' ? 'EN' : 'RU'}
          </button>
          <button
            onClick={onComplete}
            className="text-xs font-mono text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 transition-all cursor-pointer"
          >
            {language === 'ru' ? 'ПРОПУСТИТЬ →' : 'SKIP INTRO →'}
          </button>
        </div>
      </div>

      {/* MAIN SLIDES CONTAINER */}
      <div className="flex-1 max-w-2xl mx-auto flex flex-col justify-center items-center px-8 text-center relative z-10">
        
        {/* SLIDE 1: BATESON */}
        {slide === 1 && (
          <div className="space-y-6 animate-fade-in flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center animate-bounce mb-2" style={{ animationDuration: '4s' }}>
              <Layers className="w-6 h-6" />
            </div>
            
            <p className="text-[11px] font-mono tracking-widest text-[#DFB757] uppercase">
              {language === 'ru' ? 'ГРЕГОРИ БЕЙТСОН' : 'GREGORY BATESON'}
            </p>
            
            <blockquote className="text-xl md:text-2xl font-serif text-white tracking-wide leading-relaxed italic max-w-lg">
              {language === 'ru' 
                ? '«Что связывает краба и орхидею, меч и кристалл? Паттерн. Паттерн, который связывает».' 
                : '“What pattern connects the crab to the orchid and the orchid to the primrose and all four of them to me?”'}
            </blockquote>
            
            <p className="text-xs text-gray-400 font-sans leading-relaxed max-w-sm">
              {language === 'ru'
                ? 'Смыслы живут не внутри наших голов, а в пространстве между нами. Сеть мицелия связывает философию и движение.'
                : 'Meaning does not live inside static skulls, but in the interactive space between. The mycelium mesh connects philosophy and kinematics.'}
            </p>
          </div>
        )}

        {/* SLIDE 2: HANNA */}
        {slide === 2 && (
          <div className="space-y-6 animate-fade-in flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center animate-bounce mb-2" style={{ animationDuration: '4s' }}>
              <Eye className="w-6 h-6" />
            </div>

            <p className="text-[11px] font-mono tracking-widest text-[#DFB757] uppercase">
              {language === 'ru' ? 'ТОМАС ХАННА' : 'THOMAS HANNA'}
            </p>

            <blockquote className="text-xl md:text-2xl font-serif text-white tracking-wide leading-relaxed italic max-w-lg font-medium">
              {language === 'ru'
                ? '«На всё — на политику, историю, философию — можно смотреть изнутри ощущающего тела».'
                : '“All science, history, and theology must be observed through the living first-person lens of the body.”'}
            </blockquote>

            <p className="text-xs text-gray-400 font-sans leading-relaxed max-w-sm">
              {language === 'ru'
                ? 'Соматика — это способ видеть мир. Через силу гравитации, наклон костей, проприоцепцию и физическое уступание.'
                : 'Somatics is a way of seeing. Reading world structures through bone alignment, gravitational trust, and physical compliance.'}
            </p>
          </div>
        )}

        {/* SLIDE 3: MANIFESTO */}
        {slide === 3 && (
          <div className="space-y-6 animate-fade-in flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center animate-bounce mb-2" style={{ animationDuration: '4s' }}>
              <BookOpen className="w-6 h-6" />
            </div>

            <p className="text-[11px] font-mono tracking-widest text-[#DFB757] uppercase">
              {language === 'ru' ? 'МАНИФЕСТ ПЛАТФОРМЫ' : 'SEAMLESS UNIVERSE MANIFESTO'}
            </p>

            <blockquote className="text-lg md:text-xl font-sans text-white tracking-tight leading-relaxed max-w-lg font-semibold">
              {language === 'ru'
                ? '«Это место, где смыслы наконец живут своей жизнью. Здесь важны не твои селфи. Здесь важен резонанс твоих мыслей».'
                : '“A living catalog where concepts exist on their own terms. Not a place for profile summaries, but for the resonance of your physical observations.”'}
            </blockquote>

            <p className="text-xs text-gray-400 font-sans leading-relaxed max-w-sm">
              {language === 'ru'
                ? 'Вы укореняете семена, создаёте ребра, пишете истории, и наблюдаете за живой геометрией укоренения.'
                : 'Feather nodes in the collective field, establish bridging links, and inspect the somatic map of meaning.'}
            </p>
          </div>
        )}

      </div>

      {/* Bottom control row */}
      <div className="p-8 flex flex-col items-center gap-4 z-10 shrink-0">
        {/* Slide Indicator circles */}
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              onClick={() => setSlide(i)}
              className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                slide === i ? 'bg-[#DFB757] w-6' : 'bg-white/10 hover:bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* Slide navigation trigger buttons */}
        {slide < 3 ? (
          <button
            onClick={() => setSlide(prev => prev + 1)}
            className="flex items-center gap-2 text-xs font-mono tracking-wider font-bold bg-[#DFB757] text-black px-6 py-3 rounded-full hover:bg-yellow-400 cursor-pointer active:scale-95 transition-all w-48 justify-center shadow-lg"
          >
            <span>{language === 'ru' ? 'ДАЛЕЕ' : 'NEXT'}</span>
            <ChevronDown className="w-4 h-4 rotate-270" />
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="flex items-center gap-2 text-xs font-mono tracking-wider font-bold bg-gradient-to-r from-yellow-500 to-indigo-600 text-white px-7 py-3.5 rounded-full hover:opacity-95 cursor-pointer active:scale-95 transition-all w-52 justify-center shadow-xl border border-white/15"
          >
            <span>{language === 'ru' ? 'ВОЙТИ В АТЛАС' : 'ENTER ATLAS'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

    </div>
  );
}
