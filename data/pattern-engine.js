// Lightweight pattern mining — mock of TF-IDF + cosine similarity.
// Explainable, keyword-first. Runs entirely in the browser.

window.PatternEngine = (function() {

  const STOPWORDS = new Set([
    'the','a','an','and','or','for','of','on','in','to','is','was','be','at','by','as','it','this','that',
    'with','from','after','before','has','have','had','not','but','so','if','then','than','too','very'
  ]);

  // Category detection by keywords — matches the knowledge_base structure
  const CATEGORY_HINTS = {
    database_logs: ['postgres','mysql','db','query','deadlock','connection pool','replication','vacuum','sql','relation','index','autovacuum'],
    api_logs:      ['api','gateway','endpoint','upstream','auth','token','circuit breaker','http','route','post','get','latency'],
    infra_logs:    ['pod','kubelet','node','oomkilled','cluster','memory pressure','disk pressure','crashloopbackoff','imagepullbackoff','hpa','scheduler'],
  };

  function detectCategory(logLines) {
    const blob = logLines.map(l => (l.msg||l.raw||'').toLowerCase()).join(' ');
    let best = 'unknown_logs', bestScore = 0;
    for (const [cat, hints] of Object.entries(CATEGORY_HINTS)) {
      let score = 0;
      for (const h of hints) if (blob.includes(h)) score += 1;
      if (score > bestScore) { bestScore = score; best = cat; }
    }
    return bestScore > 0 ? best : 'unknown_logs';
  }

  function tokenize(text) {
    return (text||'').toLowerCase()
      .replace(/[^a-z0-9\s_\-\/]/g,' ')
      .split(/\s+/)
      .filter(w => w && w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  }

  // Error/warn lines only — those carry the pattern signal
  function errorLines(lines) {
    return lines.filter(l => /ERROR|FATAL|WARN/i.test(l.level||''));
  }

  function cosineKeyword(text, keywords) {
    const toks = new Set(tokenize(text));
    let hits = 0;
    for (const k of keywords) {
      const parts = k.toLowerCase().split(/\s+/);
      const all = parts.every(p => toks.has(p));
      if (all) hits += 1;
      else {
        // partial credit
        const any = parts.some(p => toks.has(p));
        if (any) hits += 0.4;
      }
    }
    return Math.min(1, hits / Math.max(1, keywords.length * 0.7));
  }

  // Match a set of new lines against existing patterns.
  // Returns { matches: [{pattern, score, matchedLines:[idx,...]}], unmatched: [lines] }
  function matchAgainstKB(lines, kb, threshold = 0.55) {
    const allPatterns = [];
    for (const [cat, bucket] of Object.entries(kb)) {
      for (const p of (bucket.patterns||[])) allPatterns.push({...p, category: cat});
    }

    const results = allPatterns.map(p => ({
      pattern: p,
      score: 0,
      matchedLineIdxs: [],
    }));

    const errLines = errorLines(lines);
    errLines.forEach((line, i) => {
      const text = (line.msg||line.raw||'');
      results.forEach(r => {
        const s = cosineKeyword(text, r.pattern.keywords);
        if (s >= threshold) {
          r.matchedLineIdxs.push(lines.indexOf(line));
          r.score = Math.max(r.score, s);
        }
      });
    });

    const matches = results
      .filter(r => r.matchedLineIdxs.length > 0)
      .sort((a,b) => b.matchedLineIdxs.length - a.matchedLineIdxs.length);

    // Lines that matched NO known pattern -> candidate new patterns
    const matchedIdxSet = new Set(matches.flatMap(m => m.matchedLineIdxs));
    const unmatched = errLines.filter(l => !matchedIdxSet.has(lines.indexOf(l)));

    return { matches, unmatched };
  }

  // Crude clustering of unmatched lines → new patterns
  function mineNewPatterns(unmatchedLines, sourceFile) {
    if (!unmatchedLines.length) return [];
    // Group by shared keywords
    const buckets = {};
    unmatchedLines.forEach(line => {
      const toks = tokenize(line.msg||line.raw||'');
      // Signature: top 3 distinctive tokens
      const sig = toks
        .filter(t => !['error','warn','info','fatal','after','using','with','from'].includes(t))
        .slice(0, 3).sort().join('+');
      if (!sig) return;
      if (!buckets[sig]) buckets[sig] = { lines:[], keywords: new Set() };
      buckets[sig].lines.push(line);
      toks.slice(0,5).forEach(t => buckets[sig].keywords.add(t));
    });

    return Object.entries(buckets)
      .filter(([,b]) => b.lines.length >= 1)
      .map(([sig, b], i) => ({
        id: 'P-' + String(900 + Math.floor(Math.random()*99)).padStart(3,'0'),
        title: titleCase(b.lines[0].msg.slice(0, 60)),
        description: 'New pattern discovered from ' + sourceFile + ' — ' + b.lines.length + ' similar occurrence' + (b.lines.length>1?'s':'') + '.',
        keywords: [...b.keywords].slice(0,4),
        frequency: b.lines.length,
        confidence: 0.62 + Math.random()*0.15,
        first_seen: (b.lines[0].ts||'').slice(0,10),
        last_seen: (b.lines[b.lines.length-1].ts||'').slice(0,10),
        source_files: [sourceFile],
        examples: b.lines.slice(0,2).map(l => l.msg||l.raw),
        fix: 'Needs triage — review with service owner. No historical remediation on record yet.',
        human_intervention: {
          required: true,
          owner: 'Unassigned — awaiting triage',
          severity: 'P3',
          runbook: 'No runbook yet. Document investigation steps directly on this pattern as you work.',
          escalation: 'Assign an owner within 24h or auto-close as transient.',
          avg_resolution_min: null,
        },
        isNew: true,
      }));
  }

  function titleCase(s) {
    s = s.replace(/^[A-Z]+:?\s*/,'').replace(/\s+\d+ms.*/,'').replace(/pod\s+\S+/,'pod');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Main entry — process files, return full analysis
  function analyze(files, kb, threshold = 0.55) {
    const fileResults = files.map(f => {
      const category = detectCategory(f.lines);
      const { matches, unmatched } = matchAgainstKB(f.lines, kb, threshold);
      const newPatterns = mineNewPatterns(unmatched, f.name);
      return {
        file: f,
        category,
        matches,
        newPatterns,
      };
    });

    // Aggregate: per-pattern match across files
    const patternMap = new Map();
    fileResults.forEach(fr => {
      fr.matches.forEach(m => {
        const key = m.pattern.id;
        if (!patternMap.has(key)) {
          patternMap.set(key, {
            pattern: m.pattern,
            totalHits: 0,
            bestScore: 0,
            matchingFiles: [],
          });
        }
        const agg = patternMap.get(key);
        agg.totalHits += m.matchedLineIdxs.length;
        agg.bestScore = Math.max(agg.bestScore, m.score);
        agg.matchingFiles.push({ name: fr.file.name, lineIdxs: m.matchedLineIdxs });
      });
    });

    const aggregated = [...patternMap.values()].sort((a,b) => b.totalHits - a.totalHits);
    const newPatterns = fileResults.flatMap(fr => fr.newPatterns);

    return { fileResults, aggregated, newPatterns };
  }

  return { analyze, detectCategory, matchAgainstKB, mineNewPatterns, tokenize };
})();
