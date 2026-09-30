// LivePage — connects to a local Server-Sent-Events log generator
// (tools/live-log-server.js) and renders the incoming rolling buffer through
// the same shared window.LogStream reader used everywhere else, so search,
// filters, bookmarks, and the time scrubber all work identically here.
// Owns no reading state itself — that's still hoisted in App.jsx and passed
// straight through, keyed by the live file's id like any other file.

function LivePage({
  file, kb, connected, url, onUrlChange, onConnect, onDisconnect, onClear,
  onOpenPattern,
  bookmarks, onToggleBookmark,
  reader, onReaderChange,
  selection, onSelect,
  timeWindows, onTimeWindowChange,
}) {
  const lineCount = file.lines.length;

  return (
    <div className="live-page">
      <div className="scanner-header">
        <div>
          <div className="eyebrow">Streaming</div>
          <h2>Live <strong>feed</strong></h2>
        </div>
        <div className="live-controls">
          <input
            className="live-url"
            value={url}
            onChange={e => onUrlChange(e.target.value)}
            placeholder="http://127.0.0.1:8090/stream"
            disabled={connected}
          />
          {!connected ? (
            <button className="primary-btn" style={{ width: 'auto', margin: 0, padding: '8px 18px' }} onClick={onConnect}>
              Connect
            </button>
          ) : (
            <button className="btn-sample" onClick={onDisconnect}>Disconnect</button>
          )}
          <button className="btn-sample" onClick={onClear} disabled={lineCount === 0}>Clear buffer</button>
          <span className={"scanner-state" + (connected ? ' active' : '')}>
            <span className="sd" />
            {connected ? `Live · ${lineCount} lines buffered` : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="live-body">
        <window.LogStream
          file={lineCount ? file : null}
          files={[file]}
          kb={kb}
          reader={reader}
          onReaderChange={onReaderChange}
          selection={selection}
          onSelect={onSelect}
          onJumpBookmark={(fileId, idx) => onSelect(fileId, idx)}
          bookmarks={bookmarks}
          onToggleBookmark={onToggleBookmark}
          timeWindow={timeWindows[file.id] || null}
          onTimeWindowChange={(win) => onTimeWindowChange(file.id, win)}
          onOpenPattern={onOpenPattern}
          detailsMode="pane"
          emptyMessage={<>
            Not connected.<br />
            Run <code>node tools/live-log-server.js</code> locally, then Connect above —<br />
            lines arrive over Server-Sent Events and are matched against the knowledge base live.
          </>}
        />
      </div>
    </div>
  );
}

window.LivePage = LivePage;
