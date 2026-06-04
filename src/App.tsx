import Scene from "./components/Scene";
import ErrorBoundary from "./ErrorBoundary";
import { useEffect, useState } from "react";

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log("🚀 App mounted");
    // Track if WebGL is available
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    console.log("📊 WebGL:", gl ? "✅ available" : "❌ NOT available");
    setReady(true);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: "#0a0a16" }}>
      {/* Top-left title */}
      <div
        style={{
          position: "absolute",
          top: 32,
          left: 40,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 600,
            color: "#d4a857",
            letterSpacing: 5,
            textTransform: "uppercase",
          }}
        >
          Semantic Journey
        </div>
        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 9,
            fontWeight: 300,
            color: "rgba(255,255,235,0.3)",
            letterSpacing: 3,
            marginTop: 4,
          }}
        >
          Modern Dance · Somatic Movement
        </div>
        {!ready && <div style={{
          marginTop: 12, color: "rgba(255,255,240,0.2)", fontSize: 9,
        }}>Initializing...</div>}
      </div>

      {/* Bottom hint */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 10,
            color: "rgba(255,255,235,0.15)",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          click & drag to explore · scroll to zoom
        </div>
      </div>

      {ready ? (
        <ErrorBoundary>
          <Scene />
        </ErrorBoundary>
      ) : (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,240,0.08)", fontSize: 11, letterSpacing: 3,
          textTransform: "uppercase",
        }}>
          loading…
        </div>
      )}
    </div>
  );
}

export default App;