import { useState } from 'react';

const ARROW = '#6366f1';
const PROCESS_FILL = '#818cf8';
const PROCESS_STROKE = '#4f46e5';
const IO_FILL = '#38bdf8';
const IO_STROKE = '#0284c7';
const DECISION_FILL = '#34d399';
const DECISION_STROKE = '#059669';
const TERMINATOR_FILL = '#fbbf24';
const TERMINATOR_STROKE = '#d97706';
const DOCUMENT_FILL = '#a78bfa';
const DOCUMENT_STROKE = '#7c3aed';

const FONT = { fontFamily: 'system-ui', fontWeight: 600, fill: '#1e1b4b' };

function truncate(str, len = 16) {
  if (!str || !str.trim()) return str || '';
  const s = str.trim();
  return s.length > len ? s.slice(0, len) + '…' : s;
}

function inferShape(label, index, total) {
  const t = (label || '').toLowerCase().trim();
  if (t === 'start' || t === 'begin') return 'start';
  if (t === 'end' || t === 'finish' || t === 'stop') return 'end';
  if (index === 0 && total > 1) return 'start';
  if (index === total - 1 && total > 1) return 'end';
  const inputWords = ['read', 'get', 'input', 'accept', 'receive', 'enter', 'fetch', 'load'];
  if (inputWords.some((w) => t.startsWith(w) || t.includes(' ' + w))) return 'input';
  const outputWords = ['display', 'show', 'print', 'output', 'write', 'return', 'save', 'export'];
  if (outputWords.some((w) => t.startsWith(w) || t.includes(' ' + w))) return 'output';
  const decisionWords = ['decision', 'check', 'if ', 'whether', 'is it', 'does it', 'valid?', 'yes or no'];
  if (decisionWords.some((w) => t.includes(w))) return 'decision';
  const docWords = ['document', 'report', 'file', 'record'];
  if (docWords.some((w) => t.includes(w))) return 'document';
  return 'process';
}

/** Parse input into nodes with shape types. */
function parseFlowchartInput(text) {
  const raw = (text || '').trim();
  const rawLower = raw.toLowerCase();
  if (!rawLower) return { type: 'linear', nodes: [{ label: 'Start', shape: 'start' }, { label: 'End', shape: 'end' }] };

  const decisionKeywords = ['decision', 'yes or no', 'if ', 'whether', 'choose', 'choice', 'check', 'is it', 'does it', 'should we'];
  const isDecisionOnly = decisionKeywords.some((k) => rawLower.includes(k)) && rawLower.split(/\s+/).length < 15;

  if (isDecisionOnly) {
    const question = raw.length > 35 ? raw.slice(0, 35) + '…' : raw;
    return { type: 'decision', question, yesLabel: 'Yes', noLabel: 'No' };
  }

  const stepSplitters = [/\s*[;\n]\s*/, /\s+then\s+/i, /\s+next\s+/i, /\s+after that\s+/i, /\s*\.\s+(?=[A-Z0-9])/, /\s*,\s*(?=[A-Za-z])/, /\s+-\s+/, /\s*step\s*\d+\s*[.:]?\s*/gi, /\s*(?:first|second|third|fourth|fifth|1st|2nd|3rd)\s*[.:]?\s*/gi];
  let parts = [raw];
  for (const re of stepSplitters) {
    parts = parts.flatMap((p) => (typeof p === 'string' ? p.split(re) : [p]).filter(Boolean));
  }
  let labels = parts.map((s) => s.trim().replace(/^[\d.)\-\s]+/i, '').trim()).filter((s) => s.length > 0).slice(0, 8);
  const numMatch = rawLower.match(/(\d+)\s*steps?/);
  if (numMatch && labels.length <= 1) {
    const n = Math.min(6, Math.max(1, parseInt(numMatch[1], 10)));
    labels = Array.from({ length: n }, (_, i) => labels[0] ? `${labels[0]} ${i + 1}` : `Step ${i + 1}`);
  }
  if (labels.length === 0) labels = [raw.length > 28 ? raw.slice(0, 28) + '…' : raw];
  if (labels.length === 1) labels = [labels[0], 'End'];

  const nodes = labels.map((label, i) => ({ label, shape: inferShape(label, i, labels.length) }));
  if (nodes[0].shape !== 'start') nodes[0].shape = 'start';
  if (nodes[nodes.length - 1].shape !== 'end') nodes[nodes.length - 1].shape = 'end';
  return { type: 'linear', nodes };
}

/** Single node shape (oval, rect, parallelogram, diamond, document). */
function FlowShape({ node, x, y, w, h }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const label = truncate(node.label, 12);
  const shape = node.shape || 'process';

  if (shape === 'start' || shape === 'end') {
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={w / 2 - 4} ry={h / 2 - 4} fill={TERMINATOR_FILL} stroke={TERMINATOR_STROKE} strokeWidth="2" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="11" {...FONT}>{label}</text>
      </g>
    );
  }
  if (shape === 'input' || shape === 'output') {
    const skew = 12;
    const points = `${x + skew},${y} ${x + w - skew},${y} ${x + w + skew},${y + h} ${x - skew},${y + h}`;
    return (
      <g>
        <polygon points={points} fill={IO_FILL} stroke={IO_STROKE} strokeWidth="2" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="10" {...FONT}>{label}</text>
      </g>
    );
  }
  if (shape === 'decision') {
    const d = Math.min(w, h) * 0.48;
    const path = `M${cx},${cy - d} L${cx + d},${cy} L${cx},${cy + d} L${cx - d},${cy} Z`;
    return (
      <g>
        <path d={path} fill={DECISION_FILL} stroke={DECISION_STROKE} strokeWidth="2" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="10" {...FONT}>{label}</text>
      </g>
    );
  }
  if (shape === 'document') {
    const path = `M${x},${y} L${x + w},${y} L${x + w},${y + h - 8} Q${x + w / 2},${y + h + 4} ${x},${y + h - 8} Z`;
    return (
      <g>
        <path d={path} fill={DOCUMENT_FILL} stroke={DOCUMENT_STROKE} strokeWidth="2" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" {...FONT}>{label}</text>
      </g>
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={PROCESS_FILL} stroke={PROCESS_STROKE} strokeWidth="2" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="10" {...FONT}>{label}</text>
    </g>
  );
}

/** Linear flowchart with proper shapes. */
function LinearFlowchart({ nodes }) {
  const boxW = 92;
  const boxH = 40;
  const gap = 22;
  const n = Math.min(nodes.length, 8);
  const totalW = 60 + n * (boxW + gap) - gap;
  const vbH = 120;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', padding: 24 }}>
      <svg viewBox={`0 0 ${totalW} ${vbH}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <defs>
          <marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={ARROW} />
          </marker>
        </defs>
        {nodes.slice(0, n).map((node, i) => {
          const x = 30 + i * (boxW + gap);
          const y = (vbH - boxH) / 2;
          return (
            <g key={i}>
              {i > 0 && (
                <line x1={x - gap} y1={y + boxH / 2} x2={x - 10} y2={y + boxH / 2} stroke={ARROW} strokeWidth="2" markerEnd="url(#arr)" />
              )}
              <g transform={`translate(${x}, ${y})`}>
                <FlowShape node={node} x={0} y={0} w={boxW} h={boxH} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Decision flowchart (Start → Diamond → Yes/No → End). */
function DecisionFlowchart({ question, yesLabel, noLabel }) {
  const q = truncate(question, 18);
  const yes = truncate(yesLabel, 8);
  const no = truncate(noLabel, 8);
  const w = 400;
  const h = 300;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', padding: 24 }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <defs>
          <marker id="arrow-d" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={ARROW} />
          </marker>
        </defs>
        <ellipse cx="140" cy="36" rx="52" ry="22" fill={TERMINATOR_FILL} stroke={TERMINATOR_STROKE} strokeWidth="2" />
        <text x="140" y="41" textAnchor="middle" fontSize="12" {...FONT}>Start</text>
        <line x1="140" y1="58" x2="140" y2="88" stroke={ARROW} strokeWidth="2" markerEnd="url(#arrow-d)" />
        <path d="M140 88 L208 138 L140 188 L72 138 Z" fill={DECISION_FILL} stroke={DECISION_STROKE} strokeWidth="2" />
        <text x="140" y="136" textAnchor="middle" fontSize="11" {...FONT}>{q}</text>
        <line x1="208" y1="138" x2="298" y2="92" stroke={ARROW} strokeWidth="2" markerEnd="url(#arrow-d)" />
        <line x1="72" y1="138" x2="64" y2="138" stroke={ARROW} strokeWidth="2" markerEnd="url(#arrow-d)" />
        <rect x="298" y="72" width="80" height="40" rx="6" fill={PROCESS_FILL} stroke={PROCESS_STROKE} strokeWidth="2" />
        <text x="338" y="97" textAnchor="middle" fontSize="10" {...FONT}>{yes}</text>
        <rect x="0" y="118" width="64" height="40" rx="6" fill={PROCESS_FILL} stroke={PROCESS_STROKE} strokeWidth="2" />
        <text x="32" y="143" textAnchor="middle" fontSize="10" {...FONT}>{no}</text>
        <line x1="338" y1="112" x2="338" y2="250" stroke={ARROW} strokeWidth="2" markerEnd="url(#arrow-d)" />
        <line x1="32" y1="158" x2="32" y2="250" stroke={ARROW} strokeWidth="2" markerEnd="url(#arrow-d)" />
        <ellipse cx="200" cy="272" rx="52" ry="22" fill={TERMINATOR_FILL} stroke={TERMINATOR_STROKE} strokeWidth="2" />
        <text x="200" y="277" textAnchor="middle" fontSize="12" {...FONT}>End</text>
        <line x1="308" y1="248" x2="200" y2="250" stroke={ARROW} strokeWidth="2" />
        <line x1="92" y1="248" x2="148" y2="250" stroke={ARROW} strokeWidth="2" />
      </svg>
    </div>
  );
}

function SimpleFlowchart({ label }) {
  const parsed = parseFlowchartInput(label || '');
  if (parsed.type === 'decision') {
    return <DecisionFlowchart question={parsed.question} yesLabel={parsed.yesLabel} noLabel={parsed.noLabel} />;
  }
  return <LinearFlowchart nodes={parsed.nodes || []} />;
}

function App() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [viewMode, setViewMode] = useState('input'); // 'input' | 'diagram'
  const [diagramLabel, setDiagramLabel] = useState('');
  const [diagramError, setDiagramError] = useState(null);

  const toggleMic = () => {
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = 'en-IN';
      
      if (isListening) {
        recognition.stop();
        setIsListening(false);
      } else {
        setTranscript('');
        recognition.onresult = (event) => {
          setTranscript(event.results[0][0].transcript);
          setIsListening(false);
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
        setIsListening(true);
      }
    } else {
      alert('Use Chrome/Edge for voice');
    }
  };

  const generateDemo = () => {
    if (!transcript.trim()) return;
    setDiagramError(null);
    setDiagramLabel(transcript.trim());
    setViewMode('diagram');
  };

  if (viewMode === 'diagram') {
    const handleBack = () => {
      setViewMode('input');
      setDiagramLabel('');
      setDiagramError(null);
    };
    const headerHeight = 52;
    return (
      <div style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: '#1e1b4b' }}>
        <div style={{ height: headerHeight, padding: '0 16px', background: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button
            onClick={handleBack}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(45deg, #7c3aed, #9333ea)',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
          <span style={{ color: 'white', fontWeight: '600' }}>Your flowchart</span>
          {diagramError && <span style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{diagramError}</span>}
        </div>
        <div style={{ position: 'absolute', top: headerHeight, left: 0, right: 0, bottom: 0, background: '#1e293b' }}>
          <SimpleFlowchart label={diagramLabel} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #1e1b4b 0%, #581c87 30%, #7c3aed 70%, #9333ea 100%)',
      color: 'white',
      padding: '2rem',
      fontFamily: 'system-ui',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1 style={{
        fontSize: '4rem',
        fontWeight: '900',
        background: 'linear-gradient(45deg, #facc15, #eab308)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        VibeSketch AI
      </h1>
      
      <div style={{
        background: 'rgba(88, 28, 135, 0.95)',
        backdropFilter: 'blur(30px)',
        borderRadius: '32px',
        padding: '3rem',
        border: '1px solid rgba(139, 92, 246, 0.4)',
        boxShadow: '0 35px 70px rgba(124, 58, 237, 0.4)',
        maxWidth: '600px',
        width: '100%'
      }}>
        {/* Mic Button */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <button
            onClick={toggleMic}
            style={{
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              border: '4px solid rgba(255,255,255,0.3)',
              background: isListening 
                ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                : 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))',
              color: 'white',
              fontSize: '3rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.4s ease',
              boxShadow: isListening 
                ? '0 0 40px rgba(239,68,68,0.7)' 
                : '0 0 30px rgba(139,92,246,0.5)'
            }}
          >
            {isListening ? '⏹️' : '🎙️'}
          </button>
          <p style={{
            fontSize: '1.4rem',
            opacity: isListening ? 1 : 0.9,
            marginTop: '1.5rem',
            marginBottom: 0,
            fontWeight: '600'
          }}>
            {isListening ? '🎤 Listening... Speak now!' : 'Click mic → Speak diagram idea'}
          </p>
        </div>
        
        {/* Text Area */}
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="🎤 Speak your diagram idea here... (or type)"
          style={{
            width: '100%',
            height: '220px',
            padding: '2rem',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            fontSize: '1.2rem',
            resize: 'vertical',
            fontFamily: 'monospace',
            outline: 'none',
            transition: 'all 0.3s ease'
          }}
        />
        
        {/* FIXED Generate Button - NO BLUR */}
        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={generateDemo}
            disabled={!transcript.trim()}
            style={{
              width: '100%',
              padding: '1.5rem 2rem',
              borderRadius: '20px',
              background: transcript.trim() 
                ? 'linear-gradient(45deg, #f59e0b, #d97706, #b45309)' 
                : 'rgba(255,255,255,0.15)',
              color: transcript.trim() ? '#ffffff' : 'rgba(255,255,255,0.6)',
              border: '2px solid rgba(255,255,255,0.2)',
              fontWeight: 'bold',
              fontSize: '1.3rem',
              cursor: transcript.trim() ? 'pointer' : 'not-allowed',
              opacity: 1,
              boxShadow: transcript.trim() 
                ? '0 15px 35px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.3)' 
                : '0 5px 15px rgba(255,255,255,0.1)',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}
          >
            ✨ Generate
          </button>
        </div>
      </div>
      
      <p style={{ 
        marginTop: '3rem', 
        opacity: 0.8, 
        textAlign: 'center', 
        fontSize: '1rem',
        fontWeight: '500'
      }}>
        HackTheVibe 2026       • Kerala Edition 🌴
      </p>
    </div>
  );
}

export default App;
