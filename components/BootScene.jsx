// Cinematic boot intro — typewriter lines, stepped staging, smooth fade-out.
// No deps — CSS transitions (240–640ms easeInOut, 80ms stagger).

function useTypewriter(text, active, speedMs = 26) {
  const [out, setOut] = React.useState('');
  React.useEffect(() => {
    if (!active) { setOut(''); return; }
    let i = 0;
    setOut('');
    const iv = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, speedMs);
    return () => clearInterval(iv);
  }, [text, active, speedMs]);
  return out;
}

function BootLine({ text, sub, active, done, last }) {
  const typed = useTypewriter(text, active || done, 22);
  const display = done ? text : (active ? typed : '');
  return (
    <div className={"bc-row" + ((active||done)?' in':'') + (active?' active':'')}>
      <span className="bc-ico">{done ? (last?'✓':'›') : (active ? <span className="bc-cursor"/> : '·')}</span>
      <span className="bc-main">
        {display}
        {active && <span className="bc-cursor inline"/>}
      </span>
      <span className="bc-sub">{(active || done) ? sub : ''}</span>
    </div>
  );
}

function BootScene({ onDone }) {
  const [step, setStep] = React.useState(0);
  const [fading, setFading] = React.useState(false);
  const [glitch, setGlitch] = React.useState(true);

  const LINES = [
    { t: 'Initializing Failure Pattern Miner',  s: 'v1.0.0 · msg for automotive' },
    { t: 'Loading historical knowledge',        s: 'knowledge_base.json · 3 patterns' },
    { t: 'Scanning log signatures',             s: 'TF-IDF · cosine similarity' },
    { t: 'Ready',                               s: "let's digitize. now. together." },
  ];

  React.useEffect(() => {
    const timers = [];
    // very minimal opening glitch (~180ms)
    timers.push(setTimeout(() => setGlitch(false), 180));
    LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setStep(i+1), 480 + i*620));
    });
    timers.push(setTimeout(() => setFading(true), 3400));
    timers.push(setTimeout(() => onDone && onDone(), 3900));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={"boot-scene" + (fading ? " fading" : "") + (glitch ? " glitch" : "")}>
      <div className="boot-bg">
        <div className="boot-noise"/>
        <div className="boot-grid"/>
        <div className="boot-glow"/>
        <div className="boot-vignette"/>
      </div>

      <div className="boot-stack">
        <div className="boot-brand">
          <span className="dot"/>
          <span className="brand-txt">msg <em>for automotive</em></span>
        </div>

        <div className="boot-product">
          <div className="bp-label">TRACE&nbsp;&nbsp;MINER</div>
          <div className="bp-sub">Failure Pattern Intelligence</div>
        </div>

        <div className="boot-console">
          {LINES.map((ln, i) => {
            const done = i < step - 1;
            const active = i === step - 1;
            return (
              <BootLine key={i}
                text={ln.t} sub={ln.s}
                active={active && !fading}
                done={done || (active && fading)}
                last={i === LINES.length - 1}
              />
            );
          })}
        </div>

        <div className="boot-bar">
          <div className="fill" style={{width: (Math.min(step, LINES.length)/LINES.length*100)+'%'}}/>
        </div>
      </div>
    </div>
  );
}

window.BootScene = BootScene;
