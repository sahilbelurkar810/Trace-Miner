// Aura — Web Audio sonification engine for the scan experience.
// Synthesizes subtle blips per log level. No external files.
// Uses a singleton AudioContext lazily created on first enable.

(function() {
  let ctx = null;
  let master = null;
  let enabled = false;
  let lastPlay = 0;
  const MIN_INTERVAL_MS = 55; // throttle so rapid streams don't clip

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.14;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function setEnabled(on) {
    enabled = !!on;
    if (enabled) ensureCtx();
  }
  function setVolume(v) {
    if (master) master.gain.value = Math.max(0, Math.min(1, v));
  }
  function isEnabled() { return enabled; }

  // ===== Sound primitives =====
  function blip({ freq, type='sine', dur=0.06, vol=1, decay=0.05, detune=0 }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + decay);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + decay + 0.02);
  }

  function pluck({ freq, dur=0.22, vol=0.8 }) {
    // Karplus-strong-ish: sawtooth through short AD env + lowpass
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = freq * 4;
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst({ dur=0.08, vol=0.35, lp=2200 }) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0; i<d.length; i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lp;
    src.connect(filt).connect(g).connect(master);
    src.start();
  }

  // ===== Per-level mapping — softened =====
  function playForLevel(level) {
    if (!enabled || !ensureCtx()) return;
    const now = performance.now();
    if (now - lastPlay < MIN_INTERVAL_MS) return;
    lastPlay = now;

    const L = (level || 'INFO').toUpperCase();
    switch (L) {
      case 'ERROR':
      case 'FATAL':
        // Warm two-tone, minor third, filtered down
        pluck({ freq: 280, dur: 0.18, vol: 0.32 });
        setTimeout(() => { if (ctx) pluck({ freq: 220, dur: 0.16, vol: 0.22 }); }, 40);
        break;
      case 'WARN':
      case 'WARNING':
        // Soft hollow blip
        blip({ freq: 440, type: 'triangle', dur: 0.06, vol: 0.22, decay: 0.12 });
        break;
      case 'INFO':
        // Ultra-soft low click
        blip({ freq: 200, type: 'sine', dur: 0.015, vol: 0.10, decay: 0.04 });
        break;
      case 'DEBUG':
      case 'TRACE':
        blip({ freq: 2400, type: 'sine', dur: 0.010, vol: 0.05, decay: 0.025 });
        break;
      default:
        blip({ freq: 300, type: 'sine', dur: 0.02, vol: 0.08, decay: 0.04 });
    }
  }

  // ===== Ambience during scan =====
  let ambience = null;
  function startAmbience() {
    if (!enabled || !ensureCtx() || ambience) return;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 110;
    lfo.type = 'sine';
    lfo.frequency.value = 0.18;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.value = 0.04;
    osc.connect(g).connect(master);
    osc.start(); lfo.start();
    ambience = { osc, lfo, g };
  }
  function stopAmbience() {
    if (!ambience) return;
    const t = ctx.currentTime;
    ambience.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    const refs = ambience;
    ambience = null;
    setTimeout(() => { try { refs.osc.stop(); refs.lfo.stop(); } catch(e){} }, 380);
  }

  // ===== One-off event cues =====
  function cueStart() {
    if (!enabled || !ensureCtx()) return;
    blip({ freq: 440, type: 'sine', dur: 0.05, vol: 0.25, decay: 0.1 });
    setTimeout(() => blip({ freq: 660, type: 'sine', dur: 0.05, vol: 0.25, decay: 0.1 }), 80);
  }
  function cueComplete() {
    if (!enabled || !ensureCtx()) return;
    pluck({ freq: 523.25, dur: 0.18, vol: 0.45 });
    setTimeout(() => pluck({ freq: 659.25, dur: 0.18, vol: 0.45 }), 90);
    setTimeout(() => pluck({ freq: 783.99, dur: 0.26, vol: 0.5 }), 180);
  }
  function cueMatch() {
    if (!enabled || !ensureCtx()) return;
    pluck({ freq: 880, dur: 0.14, vol: 0.38 });
  }

  // ===== UI haptic cues =====
  // Softened palette — all sines/triangles, lowpassed, short envelopes.
  // Differentiated per element type so users can learn the sound map.
  function softTone({ freq, type='sine', dur=0.04, vol=0.14, decay=0.06, lp=2600 }) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lp;
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + decay);
    osc.connect(filt).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + decay + 0.02);
  }
  // Two-tone chime — descends for close/cancel, ascends for open/confirm
  function chime(f1, f2, dur=0.05, vol=0.12) {
    softTone({ freq: f1, type: 'sine', dur, vol, decay: 0.08, lp: 3000 });
    setTimeout(() => softTone({ freq: f2, type: 'sine', dur, vol: vol*0.85, decay: 0.08, lp: 3000 }), 55);
  }

  // --- Navigation & top-level ---
  function uiNav()      { softTone({ freq: 740, type: 'sine',     dur: 0.04, vol: 0.14, decay: 0.08, lp: 2400 }); } // nav button
  function uiTabSwitch(){ chime(620, 820, 0.04, 0.12); }                                                             // tab change

  // --- Buttons / generic click ---
  function uiClick()    { softTone({ freq: 1400, type: 'sine',    dur: 0.012, vol: 0.10, decay: 0.03, lp: 2800 }); } // default click
  function uiPrimary()  { chime(660, 990, 0.05, 0.14); }                                                             // primary CTA
  function uiSecondary(){ softTone({ freq: 980, type: 'triangle', dur: 0.03, vol: 0.10, decay: 0.05, lp: 2400 }); }

  // --- Cards / selection ---
  function uiCard()     { softTone({ freq: 520, type: 'sine',     dur: 0.05, vol: 0.12, decay: 0.1, lp: 2000 }); }   // pattern card open
  function uiSelect()   { softTone({ freq: 880, type: 'sine',     dur: 0.02, vol: 0.10, decay: 0.04, lp: 2800 }); }  // list item

  // --- Toggles / filters ---
  function uiToggle(on) {
    if (on) chime(660, 880, 0.035, 0.12);
    else    chime(880, 660, 0.035, 0.10);
  }
  function uiFilter()   { softTone({ freq: 1100, type: 'triangle',dur: 0.025, vol: 0.10, decay: 0.04, lp: 2600 }); }
  function uiBookmark() { chime(988, 1318, 0.04, 0.12); }                                                            // star toggle

  // --- Input / destructive ---
  function uiType()     { softTone({ freq: 1800, type: 'sine',    dur: 0.006, vol: 0.06, decay: 0.015, lp: 3200 }); }
  function uiRemove()   { softTone({ freq: 220, type: 'triangle', dur: 0.06, vol: 0.14, decay: 0.08, lp: 1200 }); }  // delete/close

  // --- Hover / drag ---
  function uiHover() {
    if (!enabled || !ensureCtx()) return;
    softTone({ freq: 3200, type: 'sine', dur: 0.004, vol: 0.035, decay: 0.01, lp: 3600 });
  }
  function uiDrag() {
    if (!enabled || !ensureCtx()) return;
    const now = performance.now();
    if (now - lastPlay < 55) return;
    lastPlay = now;
    softTone({ freq: 1400 + Math.random()*400, type: 'sine', dur: 0.005, vol: 0.04, decay: 0.012, lp: 3200 });
  }
  function uiTap() { uiClick(); }

  window.Aura = {
    setEnabled, setVolume, isEnabled,
    playForLevel,
    startAmbience, stopAmbience,
    cueStart, cueComplete, cueMatch,
    uiClick, uiTap, uiToggle, uiHover, uiDrag,
    uiNav, uiTabSwitch, uiPrimary, uiSecondary,
    uiCard, uiSelect, uiFilter, uiBookmark,
    uiType, uiRemove,
  };
})();

// ===== Global haptic listener — element-type aware =====
document.addEventListener('click', (e) => {
  if (!window.Aura || !window.Aura.isEnabled()) return;

  // Priority order — most specific first
  // 1. Destructive / close
  if (e.target.closest('.fi-remove, .tweaks-close, [data-haptic="remove"]')) {
    window.Aura.uiRemove(); return;
  }
  // 2. Bookmark star
  if (e.target.closest('.lv-bookmark, [data-haptic="bookmark"]')) {
    window.Aura.uiBookmark(); return;
  }
  // 3. Top-level nav
  if (e.target.closest('.topnav button, [data-haptic="nav"]')) {
    window.Aura.uiNav(); return;
  }
  // 4. Tab switch
  if (e.target.closest('.log-tab, .kb-cat, .hist-cat, [data-haptic="tab"]')) {
    window.Aura.uiTabSwitch(); return;
  }
  // 5. Filter chip
  if (e.target.closest('.lv-filter, [data-haptic="filter"]')) {
    window.Aura.uiFilter(); return;
  }
  // 6. Primary CTA
  if (e.target.closest('.primary-btn, .af-save, [data-haptic="primary"]')) {
    window.Aura.uiPrimary(); return;
  }
  // 7. Cards (open pattern / open file / related)
  if (e.target.closest('.pattern-card, .related-card, .lv-file, [data-haptic="card"]')) {
    window.Aura.uiCard(); return;
  }
  // 8. Toggle-like
  const toggle = e.target.closest('.toggle, [aria-pressed], .lv-tail, [data-haptic="toggle"]');
  if (toggle) {
    const on = toggle.getAttribute('aria-pressed') === 'true' || toggle.classList.contains('on');
    window.Aura.uiToggle(on);
    return;
  }
  // 9. Secondary button
  if (e.target.closest('.btn-sample, .btn-export, .scrub-reset, .af-edit, [data-haptic="secondary"]')) {
    window.Aura.uiSecondary(); return;
  }
  // 10. Generic interactive fallback
  if (e.target.closest('button, [role="button"], .haptic')) {
    window.Aura.uiClick(); return;
  }
}, true);

// Typing — super-subtle per keystroke in text inputs / textareas
document.addEventListener('keydown', (e) => {
  if (!window.Aura || !window.Aura.isEnabled()) return;
  if (e.target.matches('input[type="text"], input[type="search"], input:not([type]), textarea')) {
    // Skip modifiers
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
      window.Aura.uiType();
    }
  }
}, true);
