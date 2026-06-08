import React, { useState, useEffect, useRef } from 'react';
import { AudioItem, SomaticNode, Domain } from '../types';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Clock, Award, Headphones, ChevronUp, ChevronDown, ListMusic, Layers 
} from 'lucide-react';

interface AudioPlayerProps {
  tracks: AudioItem[];
  allNodes: SomaticNode[];
  language: 'ru' | 'en';
  onSelectNode: (node: SomaticNode) => void;
  // Option to play a specific node directly (which maps to a track and timestamp)
  directPlayNodeId?: string | null;
  onClearDirectPlay?: () => void;
  onActiveNode?: (nodeId: string | null) => void;
}

const DOMAIN_COLORS: Record<Domain, string> = {
  body: '#E8A95C',      // warm amber
  science: '#5C9BE8',   // cold blue
  philosophy: '#9B5CE8',// purple
  movement: '#5CE87A',  // green
  cognition: '#EAEAEA',  // silver white
  hybrid: '#E85C7A'     // red-rose
};

export default function AudioPlayer({
  tracks,
  allNodes,
  language,
  onSelectNode,
  directPlayNodeId,
  onClearDirectPlay,
  onActiveNode
}: AudioPlayerProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0); // in seconds
  const [volume, setVolume] = useState<number>(0.8);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeTrack = tracks[currentTrackIndex];

  // Find node active at current simulated timestamp
  const getCurrentlyActiveTimelineNode = () => {
    const timeMs = currentTime * 1000;
    const timeline = activeTrack.timelineNodes;
    
    // Nodes are sorted by time. Find the latest node that has starting timestamp <= current time
    let activeCheckpoint = null;
    for (let i = 0; i < timeline.length; i++) {
      if (timeMs >= timeline[i].timeMs) {
        activeCheckpoint = timeline[i];
      }
    }
    return activeCheckpoint;
  };

  const currentCheckpoint = getCurrentlyActiveTimelineNode();
  const currentSomaticNode = currentCheckpoint 
    ? allNodes.find(n => n.id === currentCheckpoint.nodeId) 
    : null;

  // Let parent know which node is currently spoken/active
  useEffect(() => {
    if (onActiveNode) {
      if (isPlaying) {
        onActiveNode(currentCheckpoint?.nodeId || null);
      } else {
        onActiveNode(null);
      }
    }
  }, [currentCheckpoint?.nodeId, isPlaying, onActiveNode]);

  // Monitor external triggers for play requests
  useEffect(() => {
    if (directPlayNodeId) {
      // Find track containing this node
      const foundTrackIdx = tracks.findIndex(t => 
        t.timelineNodes.some(tn => tn.nodeId === directPlayNodeId)
      );

      if (foundTrackIdx >= 0) {
        setCurrentTrackIndex(foundTrackIdx);
        // Find checkpoint time
        const checkpoint = tracks[foundTrackIdx].timelineNodes.find(tn => tn.nodeId === directPlayNodeId);
        if (checkpoint) {
          setCurrentTime(Math.floor(checkpoint.timeMs / 1000));
        } else {
          setCurrentTime(0);
        }
        setIsPlaying(true);
        setIsMaximized(true); // Open player overlay
      }
      
      // Clear trigger
      if (onClearDirectPlay) {
        onClearDirectPlay();
      }
    }
  }, [directPlayNodeId, tracks, onClearDirectPlay]);

  // Handle playing state updates (simulation)
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= activeTrack.duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeTrack]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = clickX / width;
    setCurrentTime(Math.floor(clickPercent * activeTrack.duration));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <>
      {/* 1. COMPACT FIXED MINI PLAYER HUD (Always docked at bottom-right viewport if minimized) */}
      {!isMaximized && (
        <div 
          className="fixed bottom-4 right-4 w-[360px] bg-[#0E1528]/95 border border-white/10 backdrop-blur-md p-3 rounded-2xl flex items-center justify-between shadow-2xl z-40 cursor-pointer hover:border-yellow-500/30 transition-all animate-slide-in select-none"
          onClick={() => setIsMaximized(true)}
          id="mini-deck-player"
        >
          <div className="flex items-center gap-3 truncate pr-4">
            <div className="relative">
              {/* Disc animation spinning */}
              <div className={`w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-lg ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
                <Headphones className="w-4 h-4" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-[#0E1528] animate-pulse"></div>
            </div>
            
            <div className="truncate text-left">
              <p className="text-xs font-semibold text-white truncate">
                {language === 'ru' ? activeTrack.titleRu : activeTrack.titleEn}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {language === 'ru' ? activeTrack.authorRu : activeTrack.authorEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Play Button */}
            <button
              onClick={handlePlayPause}
              className="p-1.5 bg-white/5 hover:bg-white/15 text-white rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current text-yellow-400" /> : <Play className="w-4 h-4 fill-current text-emerald-400" />}
            </button>
            <button
              onClick={() => setIsMaximized(true)}
              className="p-1.5 bg-white/5 hover:bg-white/15 text-gray-300 rounded-lg transition-all"
              title="Maximize Control Screen"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. FULL MAXIMIZED POETIC AUDIO WORKSPACE BOARD (Slide overlay) */}
      {isMaximized && (
        <div 
          className="fixed md:top-24 top-auto bottom-0 left-0 md:w-[460px] w-full md:h-[calc(100vh-120px)] h-[82vh] bg-[#090D16]/98 border-t md:border-t-0 md:border-r border-white/10 backdrop-blur-lg text-gray-200 z-40 shadow-2xl flex flex-col overflow-hidden animate-slide-in rounded-t-3xl md:rounded-t-none"
          id="maximized-audio-board"
        >
          {/* Header */}
          <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0C1220]/75">
            <div className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-indigo-400" />
              <span className="text-[10px] font-mono tracking-wider uppercase text-gray-400">
                {language === 'ru' ? 'АУДИО-БИБЛИОТЕКА СМЫСЛОВ' : 'SOMA RECORDINGS INDEX'}
              </span>
            </div>
            <button 
              onClick={() => setIsMaximized(false)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg active:scale-95 transition-all cursor-pointer"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
            
            {/* Dynamic visual mockup cover */}
            <div className="relative w-44 h-44 mx-auto rounded-3xl bg-gradient-to-br from-slate-800 via-indigo-950 to-emerald-950 p-1 border border-white/15 shadow-2xl flex flex-col items-center justify-center overflow-hidden group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03)_1px,_transparent_1px)] bg-[size:10px_10px]" />
              <div className={`w-20 h-20 rounded-full border-2 border-dashed border-[#DFB757]/40 flex items-center justify-center p-2 text-center text-[#DFB757] mix-blend-screen ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '25s' }}>
                <Clock className="w-10 h-10 stroke-1" />
              </div>

              {/* Glowing Domain ring representation */}
              <div 
                className="absolute inset-2 rounded-full border border-[#5C9BE8]/20 animate-pulse" 
                style={{ animationDuration: '3s' }}
              />

              <span className="absolute bottom-2 text-[8px] font-mono tracking-widest text-indigo-300">
                MVP ARCHIVE DECK
              </span>
            </div>

            {/* Title Metadata */}
            <div className="text-center font-sans">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#DFB757] bg-[#DFB757]/10 px-2.5 py-0.5 rounded-full">
                {activeTrack.domain.toUpperCase()}
              </span>
              <h3 className="text-base font-bold text-white tracking-tight mt-2.5 px-4">
                {language === 'ru' ? activeTrack.titleRu : activeTrack.titleEn}
              </h3>
              <p className="text-xs text-indigo-400 font-medium mt-1">
                {language === 'ru' ? activeTrack.authorRu : activeTrack.authorEn}
              </p>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                {language === 'ru' 
                  ? `${activeTrack.sourceRu} • ${activeTrack.year} г.` 
                  : `${activeTrack.sourceEn} • ${activeTrack.year}`}
              </p>
            </div>

            {/* TIME SEEK BAR WITH TIMELINE NODE POINTS BEADS (Crucial Visual Requirement) */}
            <div className="space-y-1.5 select-none">
              <div className="flex justify-between text-[10px] font-mono text-gray-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(activeTrack.duration)}</span>
              </div>

              <div className="relative h-6 flex items-center">
                {/* Horizontal progress background bar */}
                <div 
                  className="w-full h-1.5 bg-white/10 rounded-full relative cursor-pointer"
                  onClick={handleProgressBarClick}
                >
                  <div 
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 h-full rounded-full relative"
                    style={{ width: `${(currentTime / activeTrack.duration) * 100}%` }}
                  >
                    {/* Scrub head handle dot */}
                    <div className="absolute right-0 -top-1 w-3.5 h-3.5 bg-white rounded-full shadow-lg border-2 border-indigo-500 active:scale-125 transition-all"></div>
                  </div>

                  {/* CUSTOM BEADS: colored flags marking referenced node spots */}
                  {activeTrack.timelineNodes.map((checkpoint) => {
                    const pct = (checkpoint.timeMs / 1000) / activeTrack.duration;
                    if (pct > 1.0) return null;

                    const associatedNode = allNodes.find(n => n.id === checkpoint.nodeId);
                    const color = associatedNode ? DOMAIN_COLORS[associatedNode.domain] : '#FFFFFF';
                    const activeState = (currentTime * 1000) >= checkpoint.timeMs;

                    return (
                      <div 
                        key={checkpoint.nodeId}
                        className="absolute top-1/2 -translate-y-1/2 -ml-2 group cursor-pointer z-25 hover:scale-125 transition-all"
                        style={{ left: `${pct * 100}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentTime(Math.floor(checkpoint.timeMs / 1000));
                        }}
                      >
                        {/* Shimmer beads */}
                        <div 
                          className="w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center shadow-lg"
                          style={{ 
                            backgroundColor: activeState ? color : '#111726',
                            borderColor: color
                          }}
                        >
                          <div className="w-1 h-1 bg-white rounded-full"></div>
                        </div>

                        {/* Hover Popup card explaining specific node */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0E1528] border border-white/10 p-2 rounded-lg text-[9px] w-48 hidden group-hover:block pointer-events-none text-left z-50 shadow-xl leading-snug">
                          <span className="font-bold text-white block">
                            {associatedNode ? (language === 'ru' ? associatedNode.nameRu : associatedNode.nameEn) : 'Node Link'}
                          </span>
                          <span className="text-gray-400 block mt-0.5 font-sans">
                            {language === 'ru' ? checkpoint.captionRu : checkpoint.captionEn}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* HUD BROADCAST METRICS: "Сейчас в эфире" (Synched with timestamps!) */}
            <div className="bg-[#0C1220]/75 border border-white/5 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 flex gap-1">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[7px] text-emerald-400 font-mono tracking-widest uppercase">BROADCAST</span>
              </div>
              
              <span className="text-[10px] font-mono text-[#DFB757] uppercase tracking-wide">
                {language === 'ru' ? 'СЕЙЧАС В ЭФИРЕ:' : 'MENTIONED SEMANTIC CELL NOW:'}
              </span>

              {currentSomaticNode ? (
                <div className="flex items-center justify-between mt-1 animate-fade-in">
                  <button
                    onClick={() => onSelectNode(currentSomaticNode)}
                    className="flex-1 text-left cursor-pointer hover:opacity-85"
                  >
                    <span className="text-sm font-bold text-white block underline decoration-[#DFB757] decoration-2">
                      {language === 'ru' ? currentSomaticNode.nameRu : currentSomaticNode.nameEn}
                    </span>
                    <span className="text-[11px] text-gray-400 block leading-tight font-sans mt-1">
                      {language === 'ru' ? currentCheckpoint?.captionRu : currentCheckpoint?.captionEn}
                    </span>
                  </button>
                  <button 
                    onClick={() => onSelectNode(currentSomaticNode)}
                    className="px-2.5 py-1 text-[9px] font-mono bg-white/5 border border-white/10 hover:border-white/30 text-white rounded-lg active:scale-95 transition-all text-center self-center cursor-pointer"
                  >
                    {language === 'ru' ? 'ОТКРЫТЬ' : 'INSPECT'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 font-mono italic">
                  {language === 'ru' ? 'Свободные рассуждения, трансляция нод начнется скоро...' : 'Ambient introduction narrative. Stay tuned to checkpoint marks...'}
                </p>
              )}
            </div>

            {/* CATALOG LIST OF LECTURES */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-mono tracking-widest text-[#DFB757] uppercase block mt-1">
                {language === 'ru' ? 'АРХИВНЫЕ ЗАПИСИ (ПЛЕЙЛИСТ)' : 'MVP AUDIO PLAYLIST'}
              </span>

              <div className="space-y-1.5 flex flex-col">
                {tracks.map((t, idx) => {
                  const isActive = currentTrackIndex === idx;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setCurrentTrackIndex(idx);
                        setCurrentTime(0);
                        setIsPlaying(true);
                      }}
                      className={`text-left p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between cursor-pointer group ${
                        isActive 
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-white' 
                          : 'bg-white/5 border-white/5 hover:border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate pr-3">
                        <span className="font-mono text-gray-600 text-[10px]">0{idx + 1}</span>
                        <div className="truncate">
                          <span className="font-semibold block truncate">
                            {language === 'ru' ? t.titleRu : t.titleEn}
                          </span>
                          <span className="text-[9px] text-gray-500 block truncate leading-none mt-1">
                            {language === 'ru' ? t.authorRu : t.authorEn}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Clock className="w-3.5 h-3.5 opacity-50" />
                        <span className="font-mono text-[10px] text-gray-500">{formatTime(t.duration)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* AUDIO CONTROLS PAD CONTAINER (Unscrolling at bottom) */}
          <div className="p-5 border-t border-white/10 bg-[#0E1424] shrink-0 text-gray-300">
            {/* Primary Command Deck */}
            <div className="flex items-center justify-around">
              {/* Prev */}
              <button 
                onClick={() => {
                  setCurrentTrackIndex(prev => prev === 0 ? tracks.length - 1 : prev - 1);
                  setCurrentTime(0);
                }}
                className="p-2 text-gray-400 hover:text-white active:scale-90 transition-all rounded-full cursor-pointer hover:bg-white/5"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Play / Pause with dynamic radial hover glow */}
              <button 
                onClick={handlePlayPause}
                className="w-13 h-13 rounded-full bg-white text-black flex items-center justify-center hover:bg-yellow-400 active:scale-95 transition-all shadow-xl cursor-pointer"
              >
                {isPlaying 
                  ? <Pause className="w-5 h-5 fill-current text-black" /> 
                  : <Play className="w-5 h-5 fill-current text-black ml-1" />
                }
              </button>

              {/* Next */}
              <button 
                onClick={() => {
                  setCurrentTrackIndex(prev => prev === tracks.length - 1 ? 0 : prev + 1);
                  setCurrentTime(0);
                }}
                className="p-2 text-gray-400 hover:text-white active:scale-90 transition-all rounded-full cursor-pointer hover:bg-white/5"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Volume regulator */}
            <div className="flex items-center justify-center gap-3.5 mt-4 text-xs font-mono text-gray-500 max-w-xs mx-auto">
              <Volume2 className="w-3.5 h-3.5 text-gray-400" />
              <input 
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-500 h-1 rounded-full cursor-pointer bg-white/10"
              />
              <span className="text-[10px]">{Math.floor(volume * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
