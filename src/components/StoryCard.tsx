import React, { useState } from 'react';

interface StoryCardProps {
  story: any;
  color: string;
  isMobile: boolean;
  lang: 'en' | 'ru';
}

export default function StoryCard({ story: s, color, isMobile, lang }: StoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const summary = (lang === 'ru' && s.summaryRu) ? s.summaryRu : s.summary || '';
  const context = (lang === 'ru' && s.contextRu) ? s.contextRu : s.context || '';
  const year = s.year || '';
  const figure1 = s.figure1 || '';
  const figure2 = s.figure2 || '';
  const title = s.title || '';

  const generatePreview = () => {
    if (lang === 'ru') {
      if (figure1 && figure2 && year) {
        return `А вы знали, что ${figure1} общался с ${figure2} ещё в ${year}?`;
      }
      if (figure1 && figure2) {
        return `А вы знали, что ${figure1} и ${figure2} были связаны?`;
      }
      return summary.substring(0, 100) + (summary.length > 100 ? '…' : '');
    } else {
      if (figure1 && figure2 && year) {
        return `Did you know that ${figure1} connected with ${figure2} back in ${year}?`;
      }
      if (figure1 && figure2) {
        return `Did you know that ${figure1} and ${figure2} were connected?`;
      }
      return summary.substring(0, 100) + (summary.length > 100 ? '…' : '');
    }
  };

  return (
    <div onClick={() => setExpanded(!expanded)} style={{
      background: expanded ? `rgba(255,255,240,0.06)` : "rgba(255,255,240,0.03)",
      borderRadius: 12, padding: isMobile ? "12px 14px" : "10px 12px",
      borderLeft: `2px solid ${expanded ? color : color}44`,
      cursor: 'pointer', transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
        {/* Icon + Preview */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{
            fontSize: expanded ? 16 : 14, lineHeight: 1, marginTop: 1,
            transition: 'font-size 0.2s',
          }}>
            {expanded ? '💡' : '🔗'}
          </div>
          <div>
            <div style={{
              color: expanded ? 'rgba(255,255,240,0.8)' : 'rgba(255,255,240,0.55)',
              fontSize: isMobile ? 10 : 11,
              lineHeight: 1.4,
              fontWeight: expanded ? 400 : 300,
            }}>
              {expanded ? (lang === 'ru' ? `${figure1} ↔ ${figure2}` : `${figure1} ↔ ${figure2}`) : generatePreview()}
            </div>
            {!expanded && title && <div style={{
              color: 'rgba(255,255,240,0.15)', fontSize: isMobile ? 8 : 8, marginTop: 2,
              fontStyle: 'italic',
            }}>{title}</div>}
          </div>
        </div>
        <div style={{
          color: 'rgba(255,255,240,0.2)', fontSize: 12, transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', marginTop: 2,
        }}>▾</div>
      </div>

      {/* Expanded content */}
      {expanded && <>
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(255,255,240,0.03)', borderRadius: 8,
        }}>
          {/* Figure connection */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
            color: 'rgba(255,255,240,0.5)', fontSize: isMobile ? 9 : 10,
          }}>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,240,0.6)' }}>{figure1}</span>
            <span style={{ opacity: 0.3 }}>—</span>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,240,0.6)' }}>{figure2}</span>
            {year && <span style={{
              marginLeft: 4, background: `${color}22`, color: `${color}bb`,
              padding: '1px 6px', borderRadius: 4, fontSize: isMobile ? 7 : 8,
            }}>{year}</span>}
          </div>

          {/* Summary */}
          {summary && <div style={{
            color: 'rgba(255,255,240,0.4)',
            fontSize: isMobile ? 9 : 10, lineHeight: 1.7,
            fontFamily: "'Georgia', 'Noto Serif', serif",
          }}>
            {summary}
          </div>}

          {/* Context */}
          {context && <div style={{
            color: 'rgba(255,255,240,0.15)',
            fontSize: isMobile ? 8 : 9, lineHeight: 1.5,
            marginTop: 8, padding: '6px 8px',
            background: 'rgba(255,255,240,0.03)', borderRadius: 6,
            borderLeft: `1px solid ${color}22`, fontStyle: 'italic',
          }}>
            {context}
          </div>}

          {/* Spheres */}
          {s.spheres && s.spheres.length > 0 && <div style={{
            display: "flex", flexWrap: "wrap", gap: 3, marginTop: 8,
          }}>
            {s.spheres.map((sp: string, j: number) => (
              <span key={j} style={{
                color: `${color}88`, fontSize: isMobile ? 7 : 8,
                background: `${color}11`, borderRadius: 3, padding: '1px 5px',
              }}>{sp}</span>
            ))}
          </div>}
        </div>
      </>}
    </div>
  );
}
