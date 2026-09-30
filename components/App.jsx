// Main App — boot → miner / viewer / kb / history / detail
const DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "red",
  "logDensity": "realistic",
  "audioEnabled": false
}/*EDITMODE-END*/;

const ACCENTS = {
  red:  { main: '#A01441', dark: '#84103A' },
  teal: { main: '#139EAD', dark: '#0E7F8C' },
  blue: { main: '#5866E3', dark: '#3F4CC9' },
};

// Local dev server (tools/live-log-server.js) that also proxies AI fix
// suggestions — same port it already defaults to for /stream.
const SUGGEST_FIX_URL = 'http://127.0.0.1:8090/suggest-fix';

function App() {
  const [booted, setBooted] = React.useState(false);
  const [page, setPage] = React.useState('miner');
  const [detailId, setDetailId] = React.useState(null);
  const [lastPage, setLastPage] = React.useState('miner');

  const [files, setFiles] = React.useState([]);
  const [processing, setProcessing] = React.useState(null);
  const [results, setResults] = React.useState(null);
  const [kb, setKb] = React.useState(() => JSON.parse(JSON.stringify(window.INITIAL_KB)));
  const [history, setHistory] = React.useState(() => window.SEED_HISTORY ? [...window.SEED_HISTORY] : []);
  const [toasts, setToasts] = React.useState([]);

  // Shared log-reading state — lives here (not in LogViewer/Scanner) so a
  // bookmark or filter made on one page is still there on the other, since
  // both pages already read the same `files` array by reference.
  const [bookmarks, setBookmarks] = React.useState({}); // {fileId: Set(lineIdx)}
  const [readerPrefs, setReaderPrefs] = React.useState({ query: '', levels: {ERROR:true, FATAL:true, WARN:true, INFO:true}, tail: false });
  const [selection, setSelection] = React.useState(null); // {fileId, idx} | null
  const [timeWindowsState, setTimeWindowsState] = React.useState({}); // {fileId: [lo,hi]} — absent key = full span

  // Live streaming — a local synthetic generator (tools/live-log-server.js)
  // feeds lines over SSE into a rolling capped buffer, matched against the
  // same shared LogStream/kb as every other file. kbRef exists because the
  // SSE handler is a long-lived closure that would otherwise see a stale kb
  // on every tick; liveFileRef is the equivalent for the line buffer.
  const LIVE_CAP = 500;
  const LIVE_ANALYZE_EVERY = 12;
  const [liveConnected, setLiveConnected] = React.useState(false);
  const [liveUrl, setLiveUrl] = React.useState('http://127.0.0.1:8090/stream');
  const [liveFile, setLiveFile] = React.useState({ id: 'live-feed', name: 'live-feed.stream', size: 0, type: 'unknown', lines: [] });
  const liveFileRef = React.useRef(liveFile);
  const liveSourceRef = React.useRef(null);
  const liveTickRef = React.useRef(0);
  const kbRef = React.useRef(kb);
  React.useEffect(() => { kbRef.current = kb; }, [kb]);
  React.useEffect(() => () => { if (liveSourceRef.current) liveSourceRef.current.close(); }, []);

  const tweaks = window.useTweaks ? window.useTweaks(DEFAULTS) : [DEFAULTS, ()=>{}];
  const [tweakState, setTweakState] = tweaks;

  React.useEffect(() => {
    const a = ACCENTS[tweakState.accentColor] || ACCENTS.red;
    document.documentElement.style.setProperty('--accent', a.main);
    document.documentElement.style.setProperty('--accent-dark', a.dark);
  }, [tweakState.accentColor]);

  // Aura audio sync
  React.useEffect(() => {
    if (window.Aura) window.Aura.setEnabled(!!tweakState.audioEnabled);
  }, [tweakState.audioEnabled]);

  const pushToast = (t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, ...t }]);
    setTimeout(() => {
      setToasts(ts => ts.map(x => x.id===id?{...x, exit:true}:x));
      setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 260);
    }, 4200);
  };

  const addFiles = (arr) => setFiles(prev => {
    const names = new Set(prev.map(p => p.name));
    return [...prev, ...arr.filter(a => !names.has(a.name))];
  });
  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setBookmarks(prev => { if (!prev[id]) return prev; const next = {...prev}; delete next[id]; return next; });
    setTimeWindowsState(prev => { if (!(id in prev)) return prev; const next = {...prev}; delete next[id]; return next; });
    setSelection(prev => (prev && prev.fileId === id) ? null : prev);
  };

  const toggleBookmark = (fileId, idx) => {
    setBookmarks(prev => {
      const next = {...prev};
      const s = new Set(next[fileId] || []);
      if (s.has(idx)) s.delete(idx); else s.add(idx);
      next[fileId] = s;
      return next;
    });
  };
  const patchReaderPrefs = (partial) => setReaderPrefs(prev => ({...prev, ...partial}));
  const selectLine = (fileId, idx) => setSelection({ fileId, idx });
  const setTimeWindow = (fileId, win) => {
    setTimeWindowsState(prev => {
      const next = {...prev};
      if (win == null) delete next[fileId]; else next[fileId] = win;
      return next;
    });
  };

  // Shared by the static Miner scan and the live-feed's periodic re-analyze:
  // bump frequency/last_seen/source_files on existing matches, and append any
  // freshly-mined patterns into unknown_logs.
  const applyAnalysisToKB = (out) => {
    setKb(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const today = new Date().toISOString().slice(0,10);
      out.aggregated.forEach(a => {
        for (const bucket of Object.values(next)) {
          const p = bucket.patterns.find(x => x.id === a.pattern.id);
          if (p) {
            p.frequency = (p.frequency||0) + a.totalHits;
            p.last_seen = today;
            const newSources = new Set([...(p.source_files||[]), ...a.matchingFiles.map(mf => mf.name)]);
            p.source_files = [...newSources];
          }
        }
      });
      out.newPatterns.forEach(p => { next.unknown_logs.patterns.push(p); });
      return next;
    });
    // Nobody has triaged these yet (mineNewPatterns seeds a placeholder fix
    // and fixStatus:'pending') — ask the local suggest-fix proxy for a real
    // one. Fire-and-forget per pattern; each call patches only its own id.
    out.newPatterns.forEach(p => requestSuggestFix(p));
  };

  // By-id patch across KB buckets — same shape as saveFix below, reused for
  // AI suggest-fix results so there's one way to mutate a pattern in place.
  const patchPattern = (patternId, patch) => {
    setKb(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      for (const bucket of Object.values(next)) {
        const p = bucket.patterns.find(x => x.id === patternId);
        if (p) { Object.assign(p, patch); break; }
      }
      return next;
    });
  };

  const requestSuggestFix = (pattern) => {
    // kbRef, not the closed-over `kb` state — requestSuggestFix is called
    // from applyAnalysisToKB, which the live SSE loop invokes from a
    // long-lived closure that would otherwise see a stale KB (same reason
    // kbRef exists at all, see connectLive above).
    const related = window.PatternEngine.suggestRelated(pattern, kbRef.current, 3)
      .map(r => ({
        id: r.pattern.id,
        title: r.pattern.title,
        fix: r.pattern.fix,
        applied_fix: r.pattern.applied_fix ? r.pattern.applied_fix.text : null,
      }));

    fetch(SUGGEST_FIX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: pattern.id,
        title: pattern.title,
        description: pattern.description,
        category: pattern.category,
        keywords: pattern.keywords,
        examples: pattern.examples,
        relatedFixes: related,
      }),
    })
      .then(res => res.ok ? res.json() : res.json().then(e => Promise.reject(new Error(e.error || ('HTTP ' + res.status)))))
      .then(({ fix, human_intervention }) => {
        patchPattern(pattern.id, { fix, human_intervention, fixStatus: 'done' });
      })
      .catch(() => {
        patchPattern(pattern.id, { fixStatus: 'error' });
      });
  };

  const retrySuggestFix = (patternId) => {
    let found = null;
    for (const bucket of Object.values(kb)) {
      const p = bucket.patterns.find(x => x.id === patternId);
      if (p) { found = p; break; }
    }
    if (!found) return;
    patchPattern(patternId, { fixStatus: 'pending' });
    requestSuggestFix(found);
  };

  const processLogs = async () => {
    if (files.length === 0) return;
    setResults(null);
    if (window.Aura) { window.Aura.cueStart(); window.Aura.startAmbience(); }
    const totalMs = 5000;
    const perFileMs = totalMs / files.length;
    const totalKnownPatterns = Object.values(kb).reduce((s,b) => s + b.patterns.length, 0);

    for (let fi = 0; fi < files.length; fi++) {
      const f = files[fi];
      const steps = Math.min(f.lines.length, Math.max(6, Math.floor(perFileMs/260)));
      for (let s = 0; s < steps; s++) {
        const idx = Math.min(f.lines.length-1, Math.floor(s * f.lines.length / steps));
        const globalProg = (fi + (s+1)/steps) / files.length;
        const narrations = [
          `Parsing ${f.name}…`,
          `Tokenising ${f.lines.length} lines…`,
          `Extracting keyword signatures…`,
          `Computing cosine similarity…`,
          `Comparing against ${totalKnownPatterns} known patterns…`,
          `Clustering residual signals…`,
        ];
        setProcessing({
          fileId: f.id, fileIdx: fi, lineIdx: idx,
          progress: globalProg,
          narration: narrations[Math.min(narrations.length-1, Math.floor(s/2))],
          totalKnownPatterns,
        });
        if (window.Aura) window.Aura.playForLevel(f.lines[idx]?.level);
        await new Promise(r => setTimeout(r, perFileMs/steps));
      }
    }

    const out = window.PatternEngine.analyze(files, kb, 0.5);
    setResults(out);
    applyAnalysisToKB(out);

    // Record a session in history
    const now = new Date();
    setHistory(prev => [{
      when: now.toISOString().slice(0,16).replace('T',' '),
      filesScanned: files.length,
      matched: out.aggregated.length,
      newPatterns: out.newPatterns.length,
      fileNames: files.map(f => f.name),
    }, ...prev]);

    out.aggregated.slice(0,2).forEach(a => {
      pushToast({ title: 'Pattern matched', body: `${a.pattern.id} · ${a.pattern.title.slice(0,50)}${a.pattern.title.length>50?'…':''}` });
      if (window.Aura) window.Aura.cueMatch();
    });
    out.newPatterns.slice(0,2).forEach(p => {
      pushToast({ title: 'New pattern discovered', body: `${p.id} · logged to unknown_logs` });
    });

    if (window.Aura) { window.Aura.stopAmbience(); window.Aura.cueComplete(); }
    setProcessing(null);
  };

  const connectLive = () => {
    if (liveSourceRef.current || typeof EventSource === 'undefined') return;
    let es;
    try { es = new EventSource(liveUrl); }
    catch (e) { pushToast({ title: 'Live connection failed', body: String(e && e.message || e) }); return; }

    liveSourceRef.current = es;
    setLiveConnected(true);

    es.onmessage = (evt) => {
      let line;
      try { line = JSON.parse(evt.data); } catch { return; }

      const nextLines = [...liveFileRef.current.lines, line];
      if (nextLines.length > LIVE_CAP) nextLines.splice(0, nextLines.length - LIVE_CAP);
      liveFileRef.current = { ...liveFileRef.current, lines: nextLines };
      setLiveFile(liveFileRef.current);

      liveTickRef.current += 1;
      if (liveTickRef.current % LIVE_ANALYZE_EVERY === 0) {
        const out = window.PatternEngine.analyze([liveFileRef.current], kbRef.current, 0.5);
        if (out.aggregated.length || out.newPatterns.length) applyAnalysisToKB(out);
        out.newPatterns.slice(0,2).forEach(p => {
          pushToast({ title: 'New pattern discovered · live', body: `${p.id} · logged to unknown_logs` });
          if (window.Aura) window.Aura.cueMatch();
        });
      }
    };

    es.onerror = () => {
      // EventSource auto-retries on its own; just leave the status as-is
      // rather than tearing the connection down on a transient network blip.
    };
  };

  const disconnectLive = () => {
    if (liveSourceRef.current) { liveSourceRef.current.close(); liveSourceRef.current = null; }
    setLiveConnected(false);
  };

  const clearLiveBuffer = () => {
    liveFileRef.current = { ...liveFileRef.current, lines: [] };
    setLiveFile(liveFileRef.current);
    liveTickRef.current = 0;
  };

  const openPattern = (id) => { setLastPage(page); setDetailId(id); setPage('detail'); };

  const saveFix = (patternId, fixEntry) => {
    setKb(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      for (const bucket of Object.values(next)) {
        const p = bucket.patterns.find(x => x.id === patternId);
        if (p) { p.applied_fix = fixEntry; break; }
      }
      return next;
    });
    pushToast({ title: 'Applied fix saved', body: `${patternId} · stored in knowledge_base.json` });
  };

  const exportKB = () => {
    const blob = new Blob([JSON.stringify(kb, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'knowledge_base.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    pushToast({ title: 'Export complete', body: 'knowledge_base.json downloaded' });
  };

  const patternCount = Object.values(kb).reduce((s,b) => s + b.patterns.length, 0);

  return (
    <>
      {!booted && <window.BootScene onDone={() => setBooted(true)}/>}
      <div className="app">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-brand">
              <span className="dot"/>
              <span className="name">msg</span>
              <span className="product">Trace <em>Miner</em></span>
            </div>
            <nav className="topnav">
              <button className={page==='viewer'?'active':''} onClick={() => setPage('viewer')}>
                Log Viewer {files.length>0 && <span className="badge">{files.length}</span>}
              </button>
              <button className={page==='miner'?'active':''} onClick={() => setPage('miner')}>
                Miner
              </button>
              <button className={page==='kb'?'active':''} onClick={() => setPage('kb')}>
                Knowledge base <span className="badge">{patternCount}</span>
              </button>
              <button className={page==='uploads'?'active':''} onClick={() => setPage('uploads')}>
                Uploads {files.length>0 && <span className="badge">{files.length}</span>}
              </button>
              <button className={page==='history'?'active':''} onClick={() => setPage('history')}>
                History {history.length>0 && <span className="badge">{history.length}</span>}
              </button>
              <button className={page==='live'?'active':''} onClick={() => setPage('live')}>
                Live {liveConnected && <span className="live-dot"/>}
              </button>
            </nav>
          </div>
          <div className="topbar-right">
            <button className={"aura-btn" + (tweakState.audioEnabled ? ' on' : '')}
              onClick={() => {
                const next = !tweakState.audioEnabled;
                setTweakState('audioEnabled', next);
                if (next && window.Aura) { window.Aura.setEnabled(true); window.Aura.cueStart(); }
                if (!next && window.Aura) { window.Aura.setEnabled(false); window.Aura.stopAmbience(); }
              }}
              title={tweakState.audioEnabled ? 'Aura: sonification on' : 'Aura: sonification off'}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {tweakState.audioEnabled ? (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  </>
                ) : (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                  </>
                )}
              </svg>
              <span>Aura</span>
              {tweakState.audioEnabled && <span className="aura-pulse"/>}
            </button>
            <span><span className="status-dot"/>Engine online</span>
            <span style={{fontFamily:'var(--mono)'}}>v1.0.0</span>
          </div>
        </header>

        <main style={{overflow:'hidden'}}>
          {page === 'miner' && (
            <div className="dashboard">
              <window.UploadPanel files={files} onAdd={addFiles} onRemove={removeFile} onProcess={processLogs} processing={processing}/>
              <window.Scanner files={files} processing={processing} results={results} kb={kb}
                bookmarks={bookmarks} onToggleBookmark={toggleBookmark}
                reader={readerPrefs} onReaderChange={patchReaderPrefs}
                selection={selection} onSelect={selectLine}
                timeWindows={timeWindowsState} onTimeWindowChange={setTimeWindow}
                onOpenPattern={openPattern}/>
              <window.ResultsPanel files={files} results={results} onOpen={openPattern}/>
            </div>
          )}
          {page === 'viewer' && (
            <window.LogViewer files={files} kb={kb} onOpenPattern={openPattern} onAddFiles={addFiles}
              bookmarks={bookmarks} onToggleBookmark={toggleBookmark}
              reader={readerPrefs} onReaderChange={patchReaderPrefs}
              selection={selection} onSelect={selectLine}
              timeWindows={timeWindowsState} onTimeWindowChange={setTimeWindow}/>
          )}
          {page === 'live' && (
            <window.LivePage
              file={liveFile} kb={kb}
              connected={liveConnected} url={liveUrl} onUrlChange={setLiveUrl}
              onConnect={connectLive} onDisconnect={disconnectLive} onClear={clearLiveBuffer}
              onOpenPattern={openPattern}
              bookmarks={bookmarks} onToggleBookmark={toggleBookmark}
              reader={readerPrefs} onReaderChange={patchReaderPrefs}
              selection={selection} onSelect={selectLine}
              timeWindows={timeWindowsState} onTimeWindowChange={setTimeWindow}/>
          )}
          {page === 'kb' && (
            <window.KnowledgeBase kb={kb} onOpen={openPattern} onExport={exportKB}/>
          )}
          {page === 'uploads' && (
            <window.UploadsPage files={files} history={history} kb={kb} onOpenPattern={openPattern} onRemove={removeFile}/>
          )}
          {page === 'history' && (
            <window.History kb={kb} history={history} onOpen={openPattern}/>
          )}
          {page === 'detail' && (
            <window.PatternDetail
              patternId={detailId} kb={kb} results={results}
              onBack={() => { setPage(lastPage); setDetailId(null); }}
              onOpen={openPattern}
              onSaveFix={saveFix}
              onRetrySuggestFix={retrySuggestFix}
            />
          )}
        </main>

        <footer className="footer">
          <span>© msg for automotive · Trace Miner · Failure Pattern Intelligence</span>
          <span className="mono">knowledge_base.json · {patternCount} patterns</span>
        </footer>
      </div>

      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={"toast" + (t.exit?' exit':'')}>
            <div className="t-title">{t.title}</div>
            <div className="t-body">{t.body}</div>
          </div>
        ))}
      </div>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection title="Appearance">
            <window.TweakRadio label="Accent color" value={tweakState.accentColor}
              onChange={v => setTweakState('accentColor', v)}
              options={[{value:'red', label:'msg red'},{value:'teal', label:'Teal'},{value:'blue', label:'Blue'}]}/>
          </window.TweakSection>
          <window.TweakSection title="Sample data">
            <window.TweakRadio label="Log density" value={tweakState.logDensity}
              onChange={v => {
                setTweakState('logDensity', v);
                const mult = v === 'sparse' ? 0.5 : v === 'heavy' ? 1.8 : 1;
                setFiles(prev => prev.map(f => {
                  const base = (window.SAMPLE_LOGS.find(s => s.name === f.name)?.lines) || f.lines;
                  let lines = base;
                  if (mult < 1) lines = base.slice(0, Math.ceil(base.length*mult));
                  if (mult > 1) {
                    lines = [...base];
                    while (lines.length < base.length*mult) lines = lines.concat(base.map(l => ({...l})));
                  }
                  return {...f, lines};
                }));
              }}
              options={[{value:'sparse', label:'Sparse'},{value:'realistic', label:'Realistic'},{value:'heavy', label:'Heavy'}]}/>
          </window.TweakSection>
          <window.TweakSection title="Audio">
            <window.TweakToggle label="Log sonification" value={!!tweakState.audioEnabled}
              onChange={v => {
                setTweakState('audioEnabled', v);
                if (window.Aura) {
                  window.Aura.setEnabled(v);
                  if (v) window.Aura.cueStart();
                  else window.Aura.stopAmbience();
                }
              }}/>
            <div style={{fontSize:11, color:'var(--fg-3)', marginTop:6, lineHeight:1.5}}>
              Plays subtle synth blips per log level while scanning. Web Audio — no downloads.
            </div>
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
