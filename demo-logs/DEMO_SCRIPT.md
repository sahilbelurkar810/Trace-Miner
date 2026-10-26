# Trace Miner — Demo Script

Total runtime as written: ~27-30 min. Cut everything NOT marked [CORE] for a tight 15-min version.

## Before anyone's watching

1. Two terminals running:
   - `node tools/static-server.js 5173` (the app)
   - `node tools/live-log-server.js` (AI suggest-fix + the live feed)
   Check the second one's startup log has NO "OPENAI_API_KEY not set" warning.
2. Open the app at `http://localhost:5173/`, **hard refresh** (Ctrl+Shift+R) so you're on the latest code.
3. Have `demo-logs/baseline.log`, `novel.log`, `related.log` visible in a file explorer window for easy drag-and-drop.
4. Know this: the knowledge base is **in-memory only** — a reload resets everything back to the 3 seeded patterns. Good for repeatable rehearsal, bad if something crashes mid-demo (no undo). Don't reload once you start for real.

---

## 0. Boot [EXTENDED — cut first]
Let the boot animation play once instead of skipping it.
> "Small thing, but it signals this is a crafted product, not a script someone threw together."

## 1. Positioning [CORE] — ~1 min
No clicking yet.
> "You already have Datadog, Splunk, Grafana — something watching things live. What you don't have is memory. When someone fixes a weird one-off failure, that knowledge usually dies in their head or a Slack thread that gets buried. This is institutional memory for failures: it mines logs for patterns, and now, when nobody's ever seen a failure before, an LLM drafts the first answer instead of a blank 'needs triage' ticket."

## 2. Known pattern match [CORE] — ~1:30
- Drag `baseline.log` into the Miner's drop zone.
- Click **Process logs**. Narrate the scan animation as it runs.
- Point at the result: **0 New, 1 Matched, 92%**.
- Open the pattern (P-001).
> "This already happened before. Someone solved it — see the confidence score, the matched log lines, the fix, and this —" *(point at Applied Fix)* "— is what they actually did, logged with their name and date. Nobody has to solve this one twice."

## 3. New failure → AI drafts the fix [CORE — the money moment] — ~4 min
- Drag `novel.log` in. Click **Process logs**.
- Point at **1 New**. Open it **immediately**, before it resolves.
> "Nobody has ever triaged this exact failure. Watch."
- Narrate while "AI Suggested Fix… Generating AI suggestion…" is showing (usually 2-5 seconds).
- It resolves to a real, specific written fix + severity + runbook, tagged **✦ AI**.
> "That's a live call to OpenAI, grounded in everything already in this knowledge base — not a canned response, not a hallucination off the open internet."
- Scroll to **Applied fix**. Type and save (have this ready, don't improvise):
  > "Added an idempotency key check and a per-merchant write lock to prevent concurrent webhook retries from double-processing the same reconciliation event."
> "Now this is permanent — logged with who did it and when. This is the moment human judgment gets captured instead of lost."

## 4. The "Ask a follow-up" teaser [CORE] — ~30 sec
Point at the greyed-out input box with the "COMING SOON" pill right under the AI fix.
> "Next step is making this a conversation — ask it to reconsider, add context, refine the answer — grounded in this pattern plus the whole knowledge base. The shell's built. Not wired up yet, deliberately — we didn't want to add risk this close to a demo."

## 5. Compounding memory [CORE — your strongest beat] — ~3 min
- Drag `related.log` in (different service, conceptually similar failure). Process. Open it.
- Narrate live as the AI answer appears — point out it recommends the **same idempotency/write-lock pattern** you logged two minutes ago, adapted to the new service.
> "That's the compounding effect. The more this gets used, the better the first draft gets — automatically, with zero integration work, zero retraining. It's not just an LLM wrapper — it's an LLM wrapper that actually remembers your org."

## 6. Log Viewer [EXTENDED] — ~2:30
Switch to the **Log Viewer** tab.
- Type something in search, show live highlighting.
- Toggle ERROR/WARN/INFO filter pills (mention FATAL is slaved to ERROR).
- Toggle **Tail** mode.
- Bookmark a line (★ icon).
- Narrow the **time scrubber** and show the view respecting the window.
> "Same reader component powers the Miner's scanner and the Live page — one engine, three views, so your filters and bookmarks carry over no matter which page you're on."

## 7. Knowledge base + Export [CORE] — ~2 min
- Browse the pattern list — show the category spread (Database/API/Infra/Unknown).
- Open 2-3 patterns quickly: one officer-authored (no AI badge), one AI-authored (✦ AI heading) — point out the visual distinction is deliberate.
- Click **Export**, open the downloaded `knowledge_base.json` for 5 seconds.
> "Everything — officer fixes, AI fixes, applied resolutions — is one plain JSON file. No vendor lock-in, nothing trapped behind a dashboard login. You can put this in git."

## 8. Uploads & History [EXTENDED] — ~1:30
- **Uploads**: the file list, remove/re-inspect.
- **History**: every scan session — timestamp, matched/new counts, file names.
> "Full audit trail of every scan that's ever been run."

## 9. Live feed [CORE] — ~3 min
- **Live** tab → **Connect**.
- Let lines stream, point at live pattern-highlighting.
- Wait for (or already have queued) a "new pattern discovered · live" toast → jump to Knowledge base, show it landed there with its own AI fix in flight, same as a static scan.
- **Disconnect** before it gets noisy.
> "Same engine, riding a real-time feed instead of a static file. This is the layer that sits next to your actual monitoring tool — not a replacement for it. We're not trying to out-Datadog Datadog."

## 10. Tweaks panel [EXTENDED — only if the room's enjoying it] — ~1:30
- Open the Tweaks panel (small floating icon).
- Switch accent color red → teal → blue.
- Toggle **Log sonification**, re-run a quick scan so they hear the per-level audio.
- Skip "Log density" — it only applies to the sample bundle, not custom demo files.

## 11. Close [CORE] — ~1 min
> "Officer-authored fixes. AI-drafted fixes for the gap. Human-confirmed resolutions. One knowledge base, getting smarter every single incident, and it's entirely yours — not locked in anyone's cloud. Questions?"

---

## Q&A reference (don't read verbatim, just have the shape ready)

**"What's the USP?"**
> "It's the first draft of a fix for a problem nobody's seen before — written automatically, grounded in your own team's actual incident history, not a generic LLM guess, and not another dashboard to babysit."
- *Grounded, not generic* — every suggestion uses your real knowledge base as context, not the open internet.
- *A flywheel, not a static tool* — every applied fix makes the next AI suggestion better, for free.
- *Explainable and portable* — plain keyword/cosine matching (no black box), one JSON file you own.

**"Why not just use Datadog/Splunk's built-in AI?"**
> "Those are monitoring platforms first — alerting, retention, dashboards. This isn't trying to replace that; it's the memory layer that sits next to it, specifically for the long tail of weird one-off failures that never get a runbook."

**"Why not just paste logs into ChatGPT?"**
> "You can — once. This remembers across every incident, every service, forever, and grounds every answer in what your team actually did last time, not what the internet thinks you should do."

**"How is this different from your own Log Viewer tab?"**
> "The Log Viewer is just the reading experience — search, filter, scrub. It's the same component everywhere in the app. Everything else — pattern recognition, the knowledge base, the AI fix, the audit trail — is what turns 'reading a log' into 'remembering an incident.' Compared to a traditional log viewer like LogExpert: same job you do today, except this one remembers."

**"Does it persist? What happens if I close it?"**
> "Right now the knowledge base is in-memory for the session — closing/reloading resets to the seeded patterns, Export gives you a point-in-time JSON snapshot. Persistence (auto-save, import) is the obvious next step, not yet built — deliberately, prototype-first."

---

## Timing cushion
The AI call in Act 3/5 is the one unpredictable beat. Usually 2-5 seconds, occasionally longer. If it's slow, keep talking through "Generating AI suggestion…" rather than going silent — it's part of the story, not dead air.
