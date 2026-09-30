// LogViewer — full-featured log reader replacing LogExpert. The reading
// surface itself (search, filters, bookmarks, details, time scrubber) lives
// in the shared window.LogStream component; this file owns only the file
// sidebar and the file-upload affordance specific to this page.

function LogViewer({
  files, kb, onOpenPattern, onAddFiles,
  bookmarks, onToggleBookmark,
  reader, onReaderChange,
  selection, onSelect,
  timeWindows, onTimeWindowChange,
}) {
  const [activeId, setActiveId] = React.useState(files[0]?.id || null);

  React.useEffect(() => {
    if (!activeId && files.length) setActiveId(files[0].id);
  }, [files]);

  const active = files.find(f => f.id === activeId);

  const handleUpload = async (fileList) => {
    const arr = [];
    for (const f of fileList) {
      const text = await f.text();
      const lines = window.LogParse.parseLogText(text, f.name);
      const cat = window.PatternEngine.detectCategory(lines);
      arr.push({
        id: f.name+'-'+Date.now(), name: f.name, size: f.size, lines,
        type: cat === 'database_logs' ? 'db' : cat === 'api_logs' ? 'api' : cat === 'infra_logs' ? 'infra' : 'unknown',
      });
    }
    onAddFiles(arr);
  };

  const loadSample = () => onAddFiles(window.SAMPLE_LOGS.map(l => ({...l, id: l.id+'-'+Date.now()})));

  if (files.length === 0) {
    return (
      <div style={{padding:'60px', display:'flex', flexDirection:'column', alignItems:'center', gap:20, height:'100%', justifyContent:'center'}}>
        <div style={{fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 300}}>
          Open a <strong>log file</strong> to begin reading
        </div>
        <div style={{color:'var(--fg-3)', fontSize: 13, maxWidth: 460, textAlign:'center'}}>
          Trace Miner reads .log files like a standard viewer — and highlights lines that match known failure patterns in the knowledge base.
        </div>
        <div style={{display:'flex', gap:12, marginTop:12}}>
          <label className="primary-btn" style={{width:'auto', padding:'12px 24px', cursor:'pointer'}}>
            Open log files
            <input type="file" multiple accept=".log,.txt,.json" style={{display:'none'}} onChange={e => handleUpload([...e.target.files])}/>
          </label>
          <button className="btn-sample" onClick={loadSample} style={{padding:'12px 24px'}}>Load sample bundle</button>
        </div>
      </div>
    );
  }

  return (
    <div className="logviewer">
      <div className="lv-sidebar">
        <div style={{padding:'14px 14px 8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div className="eyebrow">Open files</div>
          <label style={{cursor:'pointer', color:'var(--accent)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase'}}>
            + Add
            <input type="file" multiple accept=".log,.txt,.json" style={{display:'none'}} onChange={e => handleUpload([...e.target.files])}/>
          </label>
        </div>
        <div className="lv-files">
          {files.map(f => {
            const c = window.LogParse.levelCounts(f);
            const errs = c.ERROR + c.FATAL;
            const warns = c.WARN;
            return (
              <div key={f.id} className={"lv-file" + (activeId===f.id?' active':'')} onClick={() => setActiveId(f.id)}>
                <window.FileTypeIcon type={f.type}/>
                <div className="lv-body">
                  <div className="lv-name">{f.name}</div>
                  <div className="lv-meta">{f.lines.length} lines</div>
                </div>
                <div className="lv-counts">
                  {errs>0 && <span className="c err">{errs}</span>}
                  {warns>0 && <span className="c warn">{warns}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <window.LogStream
        file={active}
        files={files}
        kb={kb}
        reader={reader}
        onReaderChange={onReaderChange}
        selection={selection}
        onSelect={onSelect}
        onJumpBookmark={(fileId, idx) => { setActiveId(fileId); onSelect(fileId, idx); }}
        bookmarks={bookmarks}
        onToggleBookmark={onToggleBookmark}
        timeWindow={timeWindows[activeId] || null}
        onTimeWindowChange={(win) => onTimeWindowChange(activeId, win)}
        onOpenPattern={onOpenPattern}
        detailsMode="pane"
      />
    </div>
  );
}

window.LogViewer = LogViewer;
