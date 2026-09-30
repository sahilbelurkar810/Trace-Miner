// Shared log-line parsing — used by both the Miner upload panel and the
// Log Viewer's own file picker so the two don't drift.
window.LogParse = (function() {

  function parseLogText(text, fileName) {
    const rows = text.split(/\r?\n/).filter(l => l.trim());
    return rows.slice(0, 500).map(raw => {
      const tsMatch = raw.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\dZ+:-]*)/);
      const lvlMatch = raw.match(/\b(INFO|WARN(?:ING)?|ERROR|FATAL|DEBUG|TRACE)\b/i);
      return {
        ts: tsMatch ? tsMatch[1] : '',
        level: lvlMatch ? lvlMatch[1].toUpperCase().replace('WARNING', 'WARN') : 'INFO',
        msg: raw, raw,
      };
    });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function levelCounts(file) {
    const c = { ERROR: 0, WARN: 0, INFO: 0, FATAL: 0 };
    (file && file.lines || []).forEach(l => { if (c[l.level] != null) c[l.level]++; });
    return c;
  }

  return { parseLogText, formatSize, levelCounts };
})();
