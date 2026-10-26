(function(){
"use strict";
const EXAM_MIN = 120, PER_SCEN = 15, SCEN_COUNT = 4, PASS = 720;
const LS_SESSION = "cca-mock-session-v1", LS_HISTORY = "cca-mock-history-v1";
const $app = document.getElementById("app");
const LETTERS = ["A","B","C","D"];

// ── storage (best effort) ──
function load(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function drop(k){ try{ localStorage.removeItem(k); }catch(e){} }

// ── helpers ──
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const fmt = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const domOf = q => +q.t.split(".")[0];
const scaled = p => Math.round(100 + 900*p);
function mmss(ms){ ms = Math.max(0, ms); const t = Math.floor(ms/1000), h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60; return (h? h+":"+String(m).padStart(2,"0") : m) + ":" + String(s).padStart(2,"0"); }
BANK.forEach((q,i)=>{ q.id = i; });

let S = load(LS_SESSION, null);   // active session
let view = "home", reviewFilter = "all", timerId = null, railOpen = false, confirmOpen = false;
if(S && S.submitted){ view = "results"; }

function makeItems(qs){ return qs.map(q => ({ id:q.id, order: shuffle([0,1,2,3]) })); }
function newExam(){
  const scen = shuffle([1,2,3,4,5,6]).slice(0, SCEN_COUNT).sort((a,b)=>a-b);
  let qs = [];
  scen.forEach(s => { qs = qs.concat(shuffle(BANK.filter(q => q.s === s)).slice(0, PER_SCEN)); });
  S = { mode:"exam", scen, items: makeItems(qs), answers:{}, flags:{}, revealed:{}, idx:0,
        started: Date.now(), deadline: Date.now() + EXAM_MIN*60000, submitted:false };
  persist(); view = "exam"; render();
}
function newPractice(scens, dom, count, ids){
  let qs = ids ? BANK.filter(q => ids.includes(q.id)) : BANK.filter(q => scens.includes(q.s) && (dom === 0 || domOf(q) === dom));
  qs = shuffle(qs);
  if(count && !ids) qs = qs.slice(0, count);
  if(!ids) qs.sort((a,b)=>a.s-b.s);
  if(!qs.length) return false;
  S = { mode:"practice", scen:[...new Set(qs.map(q=>q.s))].sort(), items: makeItems(qs), answers:{}, flags:{}, revealed:{}, idx:0,
        started: Date.now(), deadline: null, submitted:false };
  persist(); view = "exam"; render(); return true;
}
function persist(){ if(S) save(LS_SESSION, S); }

function grade(){
  const res = { total:S.items.length, right:0, byDom:{}, byScen:{}, byTask:{} };
  S.items.forEach((it,i) => {
    const q = BANK[it.id], a = S.answers[i], ok = a === 0;
    if(ok) res.right++;
    const d = domOf(q);
    for(const [map,key] of [[res.byDom,d],[res.byScen,q.s],[res.byTask,q.t]]){
      map[key] = map[key] || {n:0,r:0}; map[key].n++; if(ok) map[key].r++;
    }
  });
  res.pct = res.right/res.total; res.scaled = scaled(res.pct);
  return res;
}
function submit(){
  S.submitted = true; S.finished = Date.now(); confirmOpen = false;
  const g = grade();
  const hist = load(LS_HISTORY, []);
  hist.unshift({ when: S.finished, mode:S.mode, right:g.right, total:g.total, scaled:g.scaled, scen:S.scen, mins: Math.round((S.finished - S.started)/60000) });
  save(LS_HISTORY, hist.slice(0, 20));
  persist(); view = "results"; reviewFilter = "all"; window.scrollTo(0,0); render();
}

// ── timer ──
function tick(){
  if(!S || S.mode !== "exam" || S.submitted || view !== "exam") return;
  const left = S.deadline - Date.now();
  const el = document.getElementById("timer");
  if(el){ el.textContent = mmss(left); el.classList.toggle("low", left < 10*60000); }
  if(left <= 0) submit();
}
function startTimer(){ clearInterval(timerId); timerId = setInterval(tick, 1000); tick(); }

// ── render ──
function render(){
  clearInterval(timerId);
  if(view === "exam" && S && !S.submitted){ renderExam(); if(S.mode === "exam") startTimer(); }
  else if(view === "results" && S && S.submitted){ renderResults(); }
  else { view = "home"; renderHome(); }
}

function renderHome(){
  const hist = load(LS_HISTORY, []);
  const live = S && !S.submitted;
  const dCounts = {}; BANK.forEach(q => { const d = domOf(q); dCounts[d] = (dCounts[d]||0)+1; });
  $app.innerHTML = `
  <main class="wrap home">
    <header class="mast">
      <span class="label">Claude Certified Architect · Foundations</span>
      <h1>Mock exam</h1>
      <p>Each attempt draws 4 of the 6 exam scenarios at random, with 15 questions per scenario, just like the real exam. Every question is scenario-based, multiple choice, with one correct answer and three plausible distractors.</p>
    </header>
    <div class="facts" role="list">
      <div class="fact" role="listitem"><span class="label">Questions</span><b>60</b></div>
      <div class="fact" role="listitem"><span class="label">Time limit</span><b>120 min</b></div>
      <div class="fact" role="listitem"><span class="label">Scenarios</span><b>4 of 6</b></div>
      <div class="fact" role="listitem"><span class="label">Pass mark</span><b>720 / 1000</b></div>
      <div class="fact" role="listitem"><span class="label">Question bank</span><b>${BANK.length}</b></div>
    </div>
    ${live ? `<div class="resume"><div><b>${S.mode === "exam" ? "Mock exam" : "Practice set"} in progress</b><div class="muted">${Object.keys(S.answers).length} of ${S.items.length} answered${S.mode==="exam" ? " · " + mmss(S.deadline - Date.now()) + " left" : ""}</div></div>
      <div class="row"><button class="btn ghost" id="discard">Discard</button><button class="btn primary" id="resume">Resume</button></div></div>` : ""}
    <section class="modes">
      <article class="mode feature">
        <span class="label">Exam conditions</span>
        <h2>Full mock exam</h2>
        <p>60 questions, a 120-minute countdown, and no feedback until you submit. Flag questions to revisit them, then see your estimated scaled score and a breakdown by domain and task statement.</p>
        <div class="row"><button class="btn primary" id="startExam" ${live ? "disabled" : ""}>Start mock exam</button>${live ? `<span class="muted">Finish or discard the current attempt first.</span>` : ""}</div>
      </article>
      <article class="mode">
        <span class="label">Study mode</span>
        <h2>Practice by topic</h2>
        <p>Untimed. See the answer and the reasoning right after each question.</p>
        <div class="field"><span class="label">Scenarios</span>
          <div class="chips">${[1,2,3,4,5,6].map(s => `<label class="chip"><input type="checkbox" id="ps${s}" value="${s}" checked>${esc(SCENARIOS[s].short)}</label>`).join("")}</div>
        </div>
        <div class="row">
          <label class="field"><span class="label">Domain</span>
            <select id="pdom"><option value="0">All domains</option>${[1,2,3,4,5].map(d => `<option value="${d}">D${d} · ${esc(DOMAINS[d].name)}</option>`).join("")}</select></label>
          <label class="field"><span class="label">Questions</span>
            <select id="pcount"><option value="10">10</option><option value="20" selected>20</option><option value="40">40</option><option value="0">All matching</option></select></label>
        </div>
        <div class="row"><button class="btn" id="startPrac" ${live ? "disabled" : ""}>Start practice</button><span class="muted" id="pmsg" role="status"></span></div>
      </article>
    </section>
    <section class="cols">
      <div class="panel">
        <h2>Exam domains</h2>
        <div class="domains">${[1,2,3,4,5].map(d => `<div class="dom"><span class="label">D${d}</span><div><div>${esc(DOMAINS[d].name)}</div><div class="bar" aria-hidden="true"><i style="width:${DOMAINS[d].weight/27*100}%"></i></div></div><b>${DOMAINS[d].weight}%</b></div>`).join("")}</div>
        <p class="note">Weightings from the official exam guide. The bank has ${[1,2,3,4,5].map(d => dCounts[d]+" D"+d).join(", ")} questions.</p>
      </div>
      <div class="panel">
        <h2>Past attempts</h2>
        ${hist.length ? `<div class="history"><table><thead><tr><th>Date</th><th>Type</th><th>Score</th><th>Result</th></tr></thead><tbody>
          ${hist.slice(0,8).map(h => `<tr><td>${esc(new Date(h.when).toLocaleDateString(undefined,{month:"short",day:"numeric"}))} ${esc(new Date(h.when).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}))}</td><td>${h.mode==="exam"?"Mock exam":"Practice"}</td><td>${h.right}/${h.total}${h.mode==="exam" ? " · "+h.scaled : ""}</td><td>${h.mode==="exam" ? `<span class="pill ${h.scaled>=PASS?"pass":"fail"}">${h.scaled>=PASS?"PASS":"FAIL"}</span>` : `<span class="pill prac">${Math.round(h.right/h.total*100)}%</span>`}</td></tr>`).join("")}
        </tbody></table></div>` : `<p class="muted" style="margin:0">No attempts yet. Your scores are saved in this browser after each attempt you submit.</p>`}
      </div>
    </section>
  </main>`;
  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  on("startExam", newExam);
  on("resume", () => { view = "exam"; render(); });
  on("discard", () => { S = null; drop(LS_SESSION); render(); });
  on("startPrac", () => {
    const scens = [1,2,3,4,5,6].filter(s => document.getElementById("ps"+s).checked);
    const ok = scens.length && newPractice(scens, +document.getElementById("pdom").value, +document.getElementById("pcount").value);
    if(!ok) document.getElementById("pmsg").textContent = "No questions match. Pick more scenarios or another domain.";
  });
}

function renderExam(){
  const i = S.idx, it = S.items[i], q = BANK[it.id], n = S.items.length;
  const isPrac = S.mode === "practice", shown = isPrac && S.revealed[i];
  const ans = S.answers[i], answered = Object.keys(S.answers).length;
  const scenFirst = S.items.findIndex(x => BANK[x.id].s === q.s);
  const scenNo = S.scen.indexOf(q.s) + 1;
  const opts = it.order.map((oi, k) => {
    let cls = "opt";
    if(shown){ if(oi === 0) cls += " right"; else if(ans === oi) cls += " wrong"; }
    else if(ans === oi) cls += " sel";
    return `<button class="${cls}" data-oi="${oi}" ${shown ? "disabled" : ""} aria-pressed="${ans===oi}"><span class="key">${LETTERS[k]}</span><span>${fmt(q.o[oi])}</span></button>`;
  }).join("");
  const correctLetter = LETTERS[it.order.indexOf(0)];
  $app.innerHTML = `
  <div class="topbar"><div class="wrap">
    <div class="title"><span class="label">${isPrac ? "Practice" : "Mock exam"}</span><span>Question ${i+1} of ${n}</span></div>
    ${isPrac ? "" : `<span class="timer" id="timer" aria-label="Time remaining">${mmss(S.deadline - Date.now())}</span>`}
    <button class="btn railtoggle" id="railBtn" aria-expanded="${railOpen}">Answers</button>
    <button class="btn ${isPrac ? "" : "primary"}" id="finish">${isPrac ? "End" : "Submit"}</button>
  </div><div class="progress" aria-hidden="true"><i style="width:${answered/n*100}%"></i></div></div>
  <main class="wrap exam">
    <section class="sheet" aria-live="polite">
      <details class="scen" ${i === scenFirst || isPrac ? "open" : ""}>
        <summary><span class="label">Scenario ${scenNo} of ${S.scen.length}</span><h3>${esc(SCENARIOS[q.s].name)}</h3><span class="tog">Show / hide</span></summary>
        <p>${esc(SCENARIOS[q.s].desc)}</p>
      </details>
      <div class="qhead"><span class="qnum">Question ${i+1}</span>
        ${shown ? `<div class="tags"><span class="tag">D${domOf(q)} · ${esc(DOMAINS[domOf(q)].name)}</span><span class="tag">${q.t} · ${esc(TASKS[q.t])}</span></div>` : ""}</div>
      <p class="qtext">${fmt(q.q)}</p>
      <div class="opts" role="group" aria-label="Answer options">${opts}</div>
      ${shown ? `<div class="explain ${ans===0?"":"no"}"><span class="verdict">${ans===0 ? "Correct." : "Not quite. The answer is " + correctLetter + "."}</span><p>${fmt(q.e)}</p></div>` : ""}
      <div class="nav">
        <button class="btn" id="prev" ${i===0?"disabled":""}>← Previous</button>
        <button class="btn flagbtn ${S.flags[i]?"on":""}" id="flag" aria-pressed="${!!S.flags[i]}">${S.flags[i]?"Flagged":"Flag for review"}</button>
        ${isPrac && ans !== undefined && !shown ? `<button class="btn primary" id="check">Check answer</button>` :
          i < n-1 ? `<button class="btn primary" id="next">Next →</button>` : `<button class="btn primary" id="finish2">${isPrac ? "Finish practice" : "Review and submit"}</button>`}
      </div>
      <p class="note kbd">Keyboard: A–D to choose, ← → to move, F to flag${isPrac ? ", Enter to check" : ""}.</p>
    </section>
    <aside class="rail ${railOpen?"open":""}" id="rail" aria-label="Answer sheet">
      <div class="row" style="justify-content:space-between"><b>Answer sheet</b><span class="muted" style="font-variant-numeric:tabular-nums">${answered}/${n} answered</span></div>
      ${S.scen.map(s => {
        const idxs = S.items.map((x,k)=>[x,k]).filter(([x])=>BANK[x.id].s===s).map(([,k])=>k);
        return `<div style="display:grid;gap:8px"><span class="label">${esc(SCENARIOS[s].short)}</span><div class="grid">${idxs.map(k => {
          let c = "cell"; if(S.answers[k] !== undefined) c += " ans";
          if(isPrac && S.revealed[k]) c += S.answers[k] === 0 ? " r" : " w";
          if(S.flags[k]) c += " flg"; if(k === i) c += " cur";
          return `<button class="${c}" data-go="${k}" aria-label="Question ${k+1}">${k+1}</button>`; }).join("")}</div></div>`;
      }).join("")}
      <div class="legend"><span><i class="a"></i>Answered</span><span><i></i>Unanswered</span><span><i class="f"></i>Flagged</span></div>
    </aside>
  </main>
  ${confirmOpen ? confirmBox() : ""}`;
  bindExam();
}

function confirmBox(){
  const n = S.items.length, un = n - Object.keys(S.answers).length, fl = Object.keys(S.flags).filter(k=>S.flags[k]).length;
  const prac = S.mode === "practice";
  return `<div class="confirm" role="dialog" aria-modal="true" aria-labelledby="cfh"><div class="box">
    <h2 id="cfh">${prac ? "End this practice set?" : "Submit your exam?"}</h2>
    <p>${un ? `<b>${un}</b> question${un>1?"s are":" is"} unanswered and will be marked incorrect.` : "All questions are answered."}${fl ? ` <b>${fl}</b> ${fl>1?"are":"is"} flagged for review.` : ""}</p>
    ${prac ? "" : `<p class="muted">You can't change answers after submitting.</p>`}
    <div class="row" style="justify-content:flex-end"><button class="btn" id="cfNo">Keep working</button><button class="btn primary" id="cfYes">${prac ? "See results" : "Submit"}</button></div>
  </div></div>`;
}

function go(k){ S.idx = Math.max(0, Math.min(S.items.length-1, k)); persist(); railOpen = false; render(); window.scrollTo(0,0); }
function choose(oi){
  const i = S.idx; if(S.mode === "practice" && S.revealed[i]) return;
  S.answers[i] = oi; persist(); render();
}
function bindExam(){
  $app.querySelectorAll(".opt").forEach(b => b.onclick = () => choose(+b.dataset.oi));
  $app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(+b.dataset.go));
  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  on("prev", () => go(S.idx-1));
  on("next", () => go(S.idx+1));
  on("check", () => { S.revealed[S.idx] = true; persist(); render(); });
  on("flag", () => { S.flags[S.idx] = !S.flags[S.idx]; persist(); render(); });
  on("railBtn", () => { railOpen = !railOpen; render(); });
  const fin = () => { confirmOpen = true; render(); const y = document.getElementById("cfYes"); if(y) y.focus(); };
  on("finish", fin); on("finish2", fin);
  on("cfNo", () => { confirmOpen = false; render(); });
  on("cfYes", submit);
}
document.addEventListener("keydown", e => {
  if(view !== "exam" || !S || S.submitted || e.metaKey || e.ctrlKey || e.altKey) return;
  if(e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if(confirmOpen){ if(e.key === "Escape"){ confirmOpen = false; render(); } return; }
  const k = e.key.toLowerCase(), it = S.items[S.idx];
  const li = ["a","b","c","d"].indexOf(k) >= 0 ? ["a","b","c","d"].indexOf(k) : ["1","2","3","4"].indexOf(k);
  if(li >= 0){ choose(it.order[li]); e.preventDefault(); }
  else if(e.key === "ArrowRight"){ if(S.idx < S.items.length-1) go(S.idx+1); }
  else if(e.key === "ArrowLeft"){ if(S.idx > 0) go(S.idx-1); }
  else if(k === "f"){ S.flags[S.idx] = !S.flags[S.idx]; persist(); render(); }
  else if(e.key === "Enter" && S.mode === "practice" && S.answers[S.idx] !== undefined && !S.revealed[S.idx]){ S.revealed[S.idx] = true; persist(); render(); }
  else if(e.key === "Escape" && railOpen){ railOpen = false; render(); }
});

function bar(r, n, mark){
  const p = n ? r/n : 0, cls = p >= .8 ? "" : p >= .65 ? "mid" : "low";
  return `<div class="bar"><i class="${cls}" style="width:${p*100}%"></i>${mark ? `<span class="mark" style="left:72%" title="Approximate pass line"></span>` : ""}</div>`;
}
function renderResults(){
  const g = grade(), prac = S.mode === "practice", pass = g.scaled >= PASS;
  const C = 2*Math.PI*46, frac = g.pct;
  const tasks = Object.entries(g.byTask).map(([t,v]) => ({t, ...v, miss:v.n-v.r})).filter(x=>x.miss>0).sort((a,b)=> (a.r/a.n)-(b.r/b.n) || b.miss-a.miss).slice(0,8);
  const wrongIds = S.items.map((it,i)=>[it,i]).filter(([,i])=>S.answers[i]!==0).map(([it])=>it.id);
  const list = S.items.map((it,i)=>({it,i})).filter(({i}) => reviewFilter==="all" ? true : reviewFilter==="wrong" ? S.answers[i]!==0 : !!S.flags[i]);
  const mins = Math.max(1, Math.round((S.finished - S.started)/60000));
  $app.innerHTML = `
  <main class="wrap results">
    <section class="score">
      <div class="dial" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--wash)" stroke-width="7"/><circle cx="50" cy="50" r="46" fill="none" stroke="${prac ? "var(--accent)" : pass ? "var(--ok)" : "var(--bad)"}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C*frac} ${C}"/></svg>
        <div class="n"><b>${prac ? Math.round(g.pct*100)+"%" : g.scaled}</b><span class="label">${prac ? "correct" : "of 1000"}</span></div></div>
      <div class="sub">
        <span class="label">${prac ? "Practice results" : "Mock exam results"}</span>
        <h1>${prac ? `${g.right} of ${g.total} correct` : pass ? "Pass: at or above the 720 mark" : "Below the 720 pass mark"}</h1>
        <p class="muted">${g.right} of ${g.total} correct (${Math.round(g.pct*100)}%) in ${mins} min${prac ? "" : ` · scenarios: ${S.scen.map(s=>esc(SCENARIOS[s].short)).join(", ")}`}.</p>
        ${prac ? "" : `<p class="note">The scaled score is an estimate: a straight linear map of your raw percentage onto 100–1000. The real exam uses a scaled model that isn't published, so treat anything near 720 as borderline.</p>`}
        <div class="row" style="margin-top:6px">
          <button class="btn primary" id="again">${prac ? "New practice set" : "Take another mock exam"}</button>
          ${wrongIds.length ? `<button class="btn" id="redo">Practice the ${wrongIds.length} I missed</button>` : ""}
          <button class="btn ghost" id="home">Home</button>
        </div>
      </div>
    </section>
    <section class="cols">
      <div class="panel"><h2>By domain</h2><div class="brk">
        ${[1,2,3,4,5].filter(d=>g.byDom[d]).map(d => `<div class="it"><div class="top"><span>D${d} · ${esc(DOMAINS[d].name)}</span><b>${g.byDom[d].r}/${g.byDom[d].n}</b></div>${bar(g.byDom[d].r, g.byDom[d].n, true)}</div>`).join("")}
      </div><p class="note">Tick mark shows 72%. Green is 80% or higher, amber 65–79%, red below 65%.</p></div>
      <div class="panel"><h2>By scenario</h2><div class="brk">
        ${S.scen.filter(s=>g.byScen[s]).map(s => `<div class="it"><div class="top"><span>${esc(SCENARIOS[s].name)}</span><b>${g.byScen[s].r}/${g.byScen[s].n}</b></div>${bar(g.byScen[s].r, g.byScen[s].n, true)}</div>`).join("")}
      </div></div>
      <div class="panel"><h2>Task statements to revisit</h2>
        ${tasks.length ? `<ul class="weak">${tasks.map(x => `<li><span class="label">${x.t}</span><span>${esc(TASKS[x.t])}</span><b class="muted" style="font-variant-numeric:tabular-nums">${x.r}/${x.n}</b></li>`).join("")}</ul>
        <p class="note">Numbers match the task statements in the exam guide and your notes.</p>` : `<p class="muted" style="margin:0">No misses. Nothing to revisit from this set.</p>`}
      </div>
    </section>
    <section style="display:grid;gap:16px">
      <div class="row" style="justify-content:space-between"><h2 style="font-size:1.35rem">Answer review</h2>
        <div class="seg" role="group" aria-label="Filter questions">
          <button data-f="all" aria-pressed="${reviewFilter==="all"}">All ${g.total}</button>
          <button data-f="wrong" aria-pressed="${reviewFilter==="wrong"}">Missed ${g.total-g.right}</button>
          <button data-f="flag" aria-pressed="${reviewFilter==="flag"}">Flagged ${Object.values(S.flags).filter(Boolean).length}</button>
        </div></div>
      <div class="review">${list.length ? list.map(({it,i}) => {
        const q = BANK[it.id], a = S.answers[i], ok = a === 0, skip = a === undefined;
        const L = oi => LETTERS[it.order.indexOf(oi)];
        return `<article class="rq ${ok?"":skip?"skip":"no"}">
          <div class="row" style="justify-content:space-between"><span class="qnum">Q${i+1} · ${ok?"Correct":skip?"Unanswered":"Incorrect"}${S.flags[i]?" · flagged":""}</span>
          <div class="tags"><span class="tag">${esc(SCENARIOS[q.s].short)}</span><span class="tag">${q.t} · ${esc(TASKS[q.t])}</span></div></div>
          <p>${fmt(q.q)}</p>
          <div class="ans">
            ${!ok && !skip ? `<div><span class="label">Your answer</span><span>${L(a)}. ${fmt(q.o[a])}</span></div>` : ""}
            <div><span class="label">${ok ? "Your answer" : "Correct answer"}</span><span>${L(0)}. ${fmt(q.o[0])}</span></div>
          </div>
          <p class="muted">${fmt(q.e)}</p>
        </article>`; }).join("") : `<p class="muted">Nothing to show for this filter.</p>`}</div>
    </section>
  </main>`;
  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  on("again", () => { if(prac){ S = null; drop(LS_SESSION); view = "home"; render(); window.scrollTo(0,0); } else newExam(); });
  on("redo", () => { newPractice(null, 0, 0, wrongIds); window.scrollTo(0,0); });
  on("home", () => { S = null; drop(LS_SESSION); view = "home"; render(); window.scrollTo(0,0); });
  $app.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { reviewFilter = b.dataset.f; render(); });
}

render();
})();
