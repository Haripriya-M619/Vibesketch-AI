import { useState, useRef, useEffect } from 'react';

// ─── PASTE YOUR GROQ API KEY HERE ────────────────────────────────────────────
// Get it FREE at: https://console.groq.com/keys
const GROQ_API_KEY = 'import.meta.env.VITE_GROQ_API_KEY';
// ─────────────────────────────────────────────────────────────────────────────

async function generateMermaidFromGroq(userText) {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
    throw new Error('NO_KEY');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are a Mermaid.js flowchart expert. Convert the user's description into a valid Mermaid flowchart.

OUTPUT RULES — STRICT:
- Output ONLY raw Mermaid syntax. No explanation. No markdown fences. No extra text whatsoever.
- Always start with exactly: flowchart TD

SHAPE RULES:
  Start / End node  →  A([Label])
  Process / Action  →  A[Label]
  Decision          →  A{Label?}
  Input / Output    →  A[/Label/]

ARROW RULES:
  Normal flow       →  A --> B
  Decision Yes      →  A{Valid?} -->|Yes| B[Next Step]
  Decision No       →  A{Valid?} -->|No| C[Handle Error]

GUIDELINES:
- Keep node labels SHORT: 2 to 4 words max
- Always include a Start node and an End node
- Max 10 nodes total
- For loops, connect back to a previous node

EXAMPLE for "user login process":
flowchart TD
    A([Start]) --> B[/Enter Username/]
    B --> C[/Enter Password/]
    C --> D{Credentials Valid?}
    D -->|Yes| E[Load Dashboard]
    D -->|No| F[Show Error]
    F --> B
    E --> G([End])`,
        },
        {
          role: 'user',
          content: userText,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq API error ${response.status}`);
  }

  const data = await response.json();
  let code = data.choices?.[0]?.message?.content?.trim() || '';
  code = code.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  return code;
}

function MermaidChart({ code }) {
  const ref = useRef(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code || !ref.current) return;
    setErr(null);
    setLoading(true);

    const render = async () => {
      try {
        if (!window.mermaid) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
          });
        }

        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            primaryColor: '#818cf8',
            primaryTextColor: '#1e1b4b',
            primaryBorderColor: '#4f46e5',
            lineColor: '#6366f1',
            secondaryColor: '#38bdf8',
            tertiaryColor: '#34d399',
            edgeLabelBackground: '#1e293b',
            fontSize: '15px',
          },
        });

        const id = 'mg' + Date.now();
        const { svg } = await window.mermaid.render(id, code);
        if (ref.current) {
          ref.current.innerHTML = svg;
          const svgEl = ref.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
        }
        setLoading(false);
      } catch (e) {
        console.error('Mermaid error:', e, '\nCode:\n', code);
        setErr('Render failed — try again with a different description.');
        setLoading(false);
      }
    };

    render();
  }, [code]);

  if (err) return (
    <div style={{ color: '#fca5a5', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem' }}>⚠️</div>
      <p style={{ marginTop: '1rem' }}>{err}</p>
    </div>
  );

  if (loading) return (
    <div style={{ color: '#a5b4fc', padding: '3rem', textAlign: 'center', opacity: 0.7 }}>
      Rendering diagram…
    </div>
  );

  return <div ref={ref} style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '2rem' }} />;
}

export default function App() {
  const [transcript, setTranscript] = useState('');
  const [viewMode, setViewMode] = useState('input');
  const [mermaidCode, setMermaidCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef(null);
  const btnRef = useRef(null);
  const labelRef = useRef(null);

  const setMicUI = (on) => {
    if (btnRef.current) {
      btnRef.current.textContent = on ? '⏹️' : '🎙️';
      btnRef.current.style.background = on
        ? 'linear-gradient(135deg,#ef4444,#dc2626)'
        : 'linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,.05))';
      btnRef.current.style.animation = on ? 'pulse 1.4s infinite' : 'none';
      btnRef.current.style.boxShadow = on
        ? '0 0 40px rgba(239,68,68,.6)'
        : '0 0 30px rgba(139,92,246,.5)';
    }
    if (labelRef.current) {
      labelRef.current.textContent = on
        ? '🎤 Listening... speak now!'
        : 'Click mic → speak your diagram idea';
    }
  };

  const toggleMic = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Use Chrome or Edge for mic'); return; }
    const r = new SR();
    r.lang = 'en-IN';
    r.continuous = false;
    r.interimResults = false;
    recognitionRef.current = r;
    r.onresult = (e) => setTranscript(e.results[0][0].transcript);
    r.onend   = () => { recognitionRef.current = null; setMicUI(false); };
    r.onerror = () => { recognitionRef.current = null; setMicUI(false); };
    r.start();
    setMicUI(true);
  };

  const generateDiagram = async () => {
    if (!transcript.trim()) return;
    setErrorMsg('');
    setViewMode('loading');
    try {
      const code = await generateMermaidFromGroq(transcript.trim());
      setMermaidCode(code);
      setViewMode('diagram');
    } catch (err) {
      console.error(err);
      if (err.message === 'NO_KEY') {
        setErrorMsg('Add your Groq API key inside App.jsx at the top.');
      } else {
        setErrorMsg('Error: ' + err.message);
      }
      setViewMode('input');
    }
  };

  if (viewMode === 'loading') return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>⚙️</div>
      <p style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '1.5rem' }}>Building your flowchart…</p>
      <p style={{ opacity: 0.55, marginTop: '0.4rem' }}>Groq AI is thinking 🧠</p>
    </div>
  );

  if (viewMode === 'diagram') return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'system-ui' }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', background: '#0f172a', borderBottom: '1px solid rgba(99,102,241,.25)' }}>
        <button onClick={() => { setViewMode('input'); setMermaidCode(''); }} style={S.btn('#7c3aed')}>← Back</button>
        <span style={{ fontWeight: 700, color: '#a5b4fc' }}>VibeSketch AI</span>
        <button onClick={generateDiagram} style={{ ...S.btn('#d97706'), marginLeft: 'auto' }}>🔄 Regenerate</button>
      </div>
      <div style={{ padding: '1rem 1.5rem 0' }}>
        <span style={{ background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.3)', borderRadius: '999px', padding: '5px 14px', fontSize: '.85rem', color: '#a5b4fc' }}>
          🎤 "{transcript}"
        </span>
      </div>
      <div style={{ margin: '1.5rem', borderRadius: '20px', background: '#1e293b', border: '1px solid rgba(99,102,241,.2)', minHeight: '420px', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .5s ease' }}>
        <MermaidChart code={mermaidCode} />
      </div>
      <details style={{ margin: '0 1.5rem 2rem', fontSize: '.8rem' }}>
        <summary style={{ cursor: 'pointer', color: '#475569' }}>View Mermaid code</summary>
        <pre style={{ marginTop: '.5rem', padding: '1rem', background: '#0f172a', borderRadius: '10px', border: '1px solid rgba(99,102,241,.2)', color: '#a5b4fc', whiteSpace: 'pre-wrap' }}>{mermaidCode}</pre>
      </details>
    </div>
  );

  const keyMissing = !GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE';

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}70%{box-shadow:0 0 0 22px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        textarea::placeholder{color:rgba(255,255,255,.3)}
        textarea:focus{outline:none;border-color:rgba(139,92,246,.6)!important}
      `}</style>

      <h1 style={{ fontSize: 'clamp(2.5rem,6vw,4rem)', fontWeight: 900, background: 'linear-gradient(45deg,#facc15,#fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '2rem', textAlign: 'center', animation: 'fadeUp .5s ease' }}>
        VibeSketch AI
      </h1>

      {keyMissing && (
        <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', borderRadius: '14px', padding: '1rem 1.5rem', maxWidth: '560px', width: '100%', marginBottom: '1.5rem', fontSize: '.9rem', color: '#fca5a5', lineHeight: 1.6 }}>
          ⚠️ <strong>Groq API key missing!</strong><br />
          1. Go to <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: '#f59e0b' }}>console.groq.com/keys</a> — it's <strong>free</strong><br />
          2. Click <strong>Create API Key</strong><br />
          3. Paste your key on <strong>line 5</strong> of this file replacing <code>YOUR_GROQ_API_KEY_HERE</code>
        </div>
      )}

      <div style={{ background: 'rgba(88,28,135,.55)', backdropFilter: 'blur(24px)', borderRadius: '28px', padding: '2.5rem', border: '1px solid rgba(139,92,246,.3)', boxShadow: '0 28px 56px rgba(124,58,237,.3)', maxWidth: '560px', width: '100%', animation: 'fadeUp .65s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <button ref={btnRef} onClick={toggleMic} style={{ width: '130px', height: '130px', borderRadius: '50%', border: '3px solid rgba(255,255,255,.2)', background: 'linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,.05))', color: 'white', fontSize: '2.8rem', cursor: 'pointer', boxShadow: '0 0 30px rgba(139,92,246,.5)', transition: 'background .3s,box-shadow .3s' }}>
            🎙️
          </button>
          <p ref={labelRef} style={{ fontSize: '1.1rem', marginTop: '1.2rem', marginBottom: 0, fontWeight: 600, opacity: .85 }}>
            Click mic → speak your diagram idea
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: '12px', padding: '.8rem 1rem', marginBottom: '1.2rem', fontSize: '.82rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
          💡 <strong style={{ color: 'rgba(255,255,255,.8)' }}>Try saying:</strong><br />
          "Steps to make tea" · "User login with validation" · "ATM withdrawal process"
        </div>

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={"Or type here...\ne.g. 'How a patient checks into a hospital'"}
          style={{ width: '100%', height: '130px', padding: '1.1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: 'white', fontSize: '1rem', resize: 'vertical', fontFamily: 'system-ui', boxSizing: 'border-box', transition: 'border .2s' }}
        />

        {errorMsg && (
          <p style={{ color: '#fca5a5', fontSize: '.9rem', marginTop: '.8rem', textAlign: 'center' }}>⚠️ {errorMsg}</p>
        )}

        <button
          onClick={generateDiagram}
          disabled={!transcript.trim() || keyMissing}
          style={{ width: '100%', marginTop: '1.2rem', padding: '1rem', borderRadius: '14px', border: 'none', background: (transcript.trim() && !keyMissing) ? 'linear-gradient(45deg,#f59e0b,#d97706)' : 'rgba(255,255,255,.08)', color: (transcript.trim() && !keyMissing) ? '#fff' : 'rgba(255,255,255,.35)', fontWeight: 700, fontSize: '1.1rem', cursor: (transcript.trim() && !keyMissing) ? 'pointer' : 'not-allowed', boxShadow: (transcript.trim() && !keyMissing) ? '0 8px 24px rgba(245,158,11,.35)' : 'none', transition: 'all .3s ease' }}
        >
          ✨ Generate Flowchart
        </button>
      </div>

      <p style={{ marginTop: '2.5rem', opacity: .45, fontSize: '.9rem' }}>HackTheVibe 2026 • Kerala Edition 🌴</p>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg,#1e1b4b 0%,#581c87 40%,#7c3aed 100%)', color: 'white', padding: '2rem', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  btn: (bg) => ({ padding: '7px 16px', borderRadius: '9px', border: 'none', background: bg, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '.9rem' }),
};