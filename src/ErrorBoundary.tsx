import React from 'react';

interface EBState { hasError: boolean; error: Error | null; }
export default class ErrorBoundary extends React.Component<{children:React.ReactNode}, EBState> {
  constructor(props:any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('❌ React error caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw', height: '100vh',
          background: '#0a0a16', color: 'rgba(255,255,240,0.6)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,240,0.8)', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,100,100,0.6)', maxWidth: 400, lineHeight: 1.5 }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <div style={{
            marginTop: 20, fontSize: 9, color: 'rgba(255,255,240,0.2)',
            border: '1px solid rgba(255,255,240,0.08)',
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
          }} onClick={() => window.location.reload()}>
            Reload ↻
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
