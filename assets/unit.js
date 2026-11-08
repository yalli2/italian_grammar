/* Unit page: renders notes, tables, examples and interactive exercises with scoring. */
(function () {
  const { LS, T, C, esc, sayBtn, exKey } = IG;
  const params = new URLSearchParams(location.search);
  const uid = params.get("u") || "1.1";
  const cat = window.CATALOG || [];
  const idx = cat.findIndex(u => u.unit === uid);
  const meta = cat[idx];
  IG.header("unit");
  const main = document.getElementById("main");
  if (!meta) { main.innerHTML = `<p class="empty">Unit not found. <a href="index.html">${esc(T("home"))}</a></p>`; return; }

  const s = document.createElement("script");
  s.src = "data/" + meta.file + "?v=" + (window.BUILD || "");
  s.onload = () => render(window.UNIT_DATA);
  document.head.appendChild(s);

  /* ---------- answer checking ---------- */
  const strip = x => x.normalize("NFD").replace(/[̀-ͯ]/g, "");
  function norm(x) {
    return String(x || "").normalize("NFC").toLowerCase()
      .replace(/[’‘`´]/g, "'").replace(/[“”«»"]/g, "")
      .replace(/[.,!?¿¡;:…]/g, " ").replace(/\s*'\s*/g, "'").replace(/\s+/g, " ").trim();
  }
  function variants(alt) {
    // "(io) parlo" -> ["io parlo", "parlo"]
    const out = new Set([alt]);
    if (/\(.*?\)/.test(alt)) {
      out.add(alt.replace(/\(([^)]*)\)/g, "$1"));
      out.add(alt.replace(/\([^)]*\)/g, " "));
    }
    return [...out].map(norm);
  }
  function grade(input, alts) {
    const n = norm(input);
    if (!n) return 0;
    let best = 0;
    for (const a of alts) for (const v of variants(a)) {
      if (n === v) return 1;
      if (strip(n).replace(/'/g, "") === strip(v).replace(/'/g, "")) best = 0.5;
    }
    return best;
  }

  /* ---------- rendering ---------- */
  let unitEx = []; // all exercise controllers
  function render(U) {
    document.title = `${uid} ${C(U.title)} · Italian Grammar`;
    const prev = cat[idx - 1], next = cat[idx + 1];
    const toc = U.sections.map(sec => `<li><a href="#s-${esc(sec.id)}" data-sec="${esc(sec.id)}"><span class="sid">${esc(sec.id)}</span> ${esc(C(sec.title))}<em class="tocsc"></em></a></li>`).join("");
    main.innerHTML = `
      <header class="unithead">
        <div class="crumbs"><a href="index.html">${esc(T("allUnits"))}</a> › ${esc(T("ch" + meta.chapter))}</div>
        <h1><span class="uid">${esc(uid)}</span> ${esc(C(U.title))}</h1>
        <p class="lead">${esc(C(U.summary))}</p>
        <p class="meta">${esc(T("pages"))} ${esc(U.pages || "")} · ${U.sections.length} ${esc(T("sections"))} · ${meta.nEx} ${esc(T("exercises"))} · ${meta.nItems} ${esc(T("items"))}</p>
        ${lang() === "ko" || lang() === "en" ? "" : `<p class="note-lang">ℹ️ ${esc(T("contentLang"))}</p>`}
      </header>
      <div class="scorebar" id="scorebar">
        <div class="sb-label">${esc(T("unitScore"))}</div>
        <div class="sb-track"><div class="sb-fill" id="sbFill"></div></div>
        <div class="sb-num" id="sbNum">–</div>
        <button class="btn" id="checkAll">${esc(T("checkAll"))}</button>
        <button class="btn ghost" id="resetAll">${esc(T("resetAll"))}</button>
      </div>
      <div class="unitgrid">
        <aside class="toc"><div class="tocin"><h3>${esc(T("contents"))}</h3><ol>${toc}</ol>
          <p class="tip">${esc(T("tapToHear"))}</p></div></aside>
        <div class="content" id="content"></div>
      </div>
      <nav class="pager">
        ${prev ? `<a class="btn ghost" href="unit.html?u=${encodeURIComponent(prev.unit)}">← ${esc(prev.unit)} ${esc(C(prev.title))}</a>` : "<span></span>"}
        ${next ? `<a class="btn" href="unit.html?u=${encodeURIComponent(next.unit)}">${esc(next.unit)} ${esc(C(next.title))} →</a>` : "<span></span>"}
      </nav>`;
    const content = document.getElementById("content");
    U.sections.forEach(sec => content.appendChild(renderSection(sec)));
    document.getElementById("checkAll").onclick = () => { unitEx.forEach(x => x.check()); updateUnitScore(); };
    document.getElementById("resetAll").onclick = () => {
      if (!confirm(T("resetConfirm"))) return;
      LS.keys(`ig:s:${uid}|`).concat(LS.keys(`ig:a:${uid}|`)).forEach(k => LS.del(k));
      location.reload();
    };
    updateUnitScore();
    if (location.hash) { const el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) setTimeout(() => el.scrollIntoView(), 50); }
    spy();
  }
  function lang() { return IG.lang(); }

  function renderSection(sec) {
    const el = document.createElement("section");
    el.className = "sec"; el.id = "s-" + sec.id;
    let h = `<h2><span class="sid">${esc(sec.id)}</span> ${esc(C(sec.title))}</h2>`;
    if (sec.notes && sec.notes.length) h += `<div class="notes"><div class="tag">📘 ${esc(T("notes"))}</div>${sec.notes.map(n => `<div class="note">${C(n)}</div>`).join("")}</div>`;
    if (sec.tables && sec.tables.length) h += sec.tables.map(renderTable).join("");
    if (sec.examples && sec.examples.length) {
      h += `<div class="examples"><div class="tag">💬 ${esc(T("examples"))}</div><ul>${sec.examples.map(e =>
        `<li>${sayBtn(e.it)}<div><span class="it">${esc(e.it)}</span><span class="tr">${esc(lang() === "ko" ? (e.ko || e.en) : e.en)}</span></div></li>`).join("")}</ul></div>`;
    }
    el.innerHTML = h;
    (sec.exercises || []).forEach(ex => {
      const c = makeExercise(sec, ex);
      unitEx.push(c);
      el.appendChild(c.el);
    });
    return el;
  }

  function cellSay(t) { return t.replace(/([A-Za-zÀ-ÿ']+)\/[a-zà-ù]{1,2}(?![A-Za-zÀ-ÿ])/g, "$1").replace(/\s*\/\s*/g, ", "); }
  function renderTable(t) {
    const skip = (t.head || []).map(x => /english|inglese|meaning|korean|한국|translation/i.test(x || ""));
    const cell = (v, i, tag) => {
      const txt = String(v == null ? "" : v);
      const say = !skip[i] && /[a-zà-ù]/i.test(txt) && txt.length < 80;
      return `<${tag}${say ? ` class="sc" data-say="${esc(cellSay(txt))}"` : ""}>${esc(txt)}</${tag}>`;
    };
    return `<div class="tablewrap"><div class="tag">📊 ${esc(C(t.caption) || T("tables"))}</div><div class="tscroll"><table>
      ${t.head && t.head.length ? `<thead><tr>${t.head.map((x, i) => cell(x, i, "th")).join("")}</tr></thead>` : ""}
      <tbody>${(t.rows || []).map(r => `<tr>${r.map((x, i) => cell(x, i, "td")).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  }

  /* ---------- exercises ---------- */
  function shuffle(a, seed) { const r = a.slice(); let s = seed || 7; for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
  const L = "abcdefghijklmnopqrstuvwxyz";

  function makeExercise(sec, ex) {
    const key = exKey(uid, sec.id, ex.id);
    const akey = key.replace("ig:s:", "ig:a:");
    const saved = LS.get(akey, {});
    const el = document.createElement("div");
    el.className = "ex type-" + ex.type; el.id = `x-${sec.id}-${ex.id}`;
    const isOpen = ex.type === "open";
    el.innerHTML = `<div class="exhead"><span class="exid">${esc(ex.id)}</span><p class="instr">${esc(C(ex.instruction))}</p><span class="exscore"></span></div>
      ${ex.wordbank && ex.wordbank.length ? `<div class="wordbank"><span>${esc(T("wordbank"))}:</span>${ex.wordbank.map(w => `<button type="button" class="chip wb">${esc(w)}</button>`).join("")}</div>` : ""}
      <ol class="items"></ol>
      <div class="exfoot">${isOpen ? `<span class="muted">${esc(T("openNote"))}</span>` :
        `<button class="btn" data-act="check">✔ ${esc(T("check"))}</button><button class="btn ghost" data-act="show">${esc(T("showAnswers"))}</button><button class="btn ghost" data-act="retry">↺ ${esc(T("retry"))}</button>`}
        <span class="result"></span></div>`;
    const ol = el.querySelector(".items");
    let lastInput = null;
    const ctrls = [];
    ex.items.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = "item";
      const sv = saved[i];
      if (ex.type === "fill") {
        let n = 0;
        const parts = esc(it.q).split("___");
        const maxLen = Math.max(...it.a.map(alts => Math.max(...alts.map(x => x.length))));
        const wide = maxLen > 22 || (parts.length === 2 && !parts[1].trim() && maxLen > 14);
        let html = "";
        parts.forEach((p, k) => {
          html += p;
          if (k < parts.length - 1) {
            const w = Math.max(4, Math.min(28, Math.max(...it.a[k].map(x => x.length)) + 2));
            const val = sv && sv[k] ? esc(sv[k]) : "";
            html += `<input class="blank${wide ? " wide" : ""}" data-k="${n++}" autocomplete="off" autocapitalize="off" spellcheck="false" style="--w:${w}ch" value="${val}">`;
          }
        });
        li.innerHTML = `<span class="ilabel">${L[i] || i + 1}</span><div class="ibody"><div class="q">${html}${it.hint ? ` <span class="hint">${esc(it.hint)}</span>` : ""}</div><div class="fb"></div></div>`;
        const inputs = [...li.querySelectorAll("input")];
        inputs.forEach(inp => {
          inp.addEventListener("focus", () => { lastInput = inp; IG_ACCENT.attach(inp); });
          inp.addEventListener("keydown", e => {
            if (e.key === "Enter") {
              e.preventDefault();
              const all = [...el.querySelectorAll("input.blank")]; const j = all.indexOf(inp);
              if (j < all.length - 1) all[j + 1].focus(); else ctrl.check();
            }
          });
        });
        ctrls.push({
          max: it.a.length,
          get: () => inputs.map(x => x.value),
          grade() { let p = 0; inputs.forEach((inp, k) => { const g = grade(inp.value, it.a[k]); p += g; mark(inp, g); }); return p; },
          reveal() { inputs.forEach((inp, k) => { inp.value = it.a[k][0]; mark(inp, 1); }); },
          clear() { inputs.forEach(inp => { inp.value = ""; mark(inp, null); }); },
          li, it
        });
      } else if (ex.type === "choice") {
        li.innerHTML = `<span class="ilabel">${L[i] || i + 1}</span><div class="ibody"><div class="q">${esc(it.q || "")}</div><div class="opts">${it.options.map((o, k) => `<button type="button" class="opt" data-k="${k}">${esc(o)}</button>`).join("")}</div><div class="fb"></div></div>`;
        const opts = [...li.querySelectorAll(".opt")];
        let sel = sv != null ? sv : null;
        const paint = () => opts.forEach((o, k) => o.classList.toggle("sel", k === sel));
        opts.forEach((o, k) => o.onclick = () => { sel = k; paint(); opts.forEach(x => x.classList.remove("ok", "bad")); save(); });
        paint();
        ctrls.push({
          max: 1, get: () => sel,
          grade() { opts.forEach(x => x.classList.remove("ok", "bad")); if (sel == null) return 0; const ok = sel === it.a; opts[sel].classList.add(ok ? "ok" : "bad"); if (!ok) opts[it.a].classList.add("ok"); return ok ? 1 : 0; },
          reveal() { sel = it.a; paint(); opts[it.a].classList.add("ok"); },
          clear() { sel = null; paint(); opts.forEach(x => x.classList.remove("ok", "bad")); },
          li, it
        });
      } else if (ex.type === "multi") {
        li.innerHTML = `<div class="ibody"><div class="q">${esc(it.q || T("selectAll"))}</div><div class="opts">${it.options.map((o, k) => `<button type="button" class="opt multi" data-k="${k}">${esc(o)}</button>`).join("")}</div><div class="fb"></div></div>`;
        const opts = [...li.querySelectorAll(".opt")];
        let sel = new Set(Array.isArray(sv) ? sv : []);
        const paint = () => opts.forEach((o, k) => o.classList.toggle("sel", sel.has(k)));
        opts.forEach((o, k) => o.onclick = () => { sel.has(k) ? sel.delete(k) : sel.add(k); paint(); opts.forEach(x => x.classList.remove("ok", "bad", "miss")); save(); });
        paint();
        const corr = new Set(it.a);
        ctrls.push({
          max: 1, get: () => [...sel],
          grade() {
            let good = 0, badN = 0;
            opts.forEach((o, k) => { o.classList.remove("ok", "bad", "miss");
              if (sel.has(k) && corr.has(k)) { good++; o.classList.add("ok"); }
              else if (sel.has(k)) { badN++; o.classList.add("bad"); }
              else if (corr.has(k)) o.classList.add("miss"); });
            return corr.size ? Math.max(0, (good - badN) / corr.size) : (badN ? 0 : 1);
          },
          reveal() { sel = new Set(it.a); paint(); opts.forEach((o, k) => o.classList.toggle("ok", corr.has(k))); },
          clear() { sel = new Set(); paint(); opts.forEach(x => x.classList.remove("ok", "bad", "miss")); },
          li, it
        });
      } else if (ex.type === "match") {
        const rights = shuffle(it.pairs.map(p => p[1]), it.pairs.length * 31 + i + ex.id.length);
        li.className = "item matchitem";
        li.innerHTML = `<div class="ibody"><table class="match">${it.pairs.map((p, k) => `<tr><td class="ml">${L[k] || k + 1}. ${it.sayLeft ? sayBtn(p[0], "mini") : ""}${esc(p[0])}</td><td><select data-k="${k}"><option value="">${esc(T("choose"))}</option>${rights.map(r => `<option ${sv && sv[k] === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></td><td class="mfb"></td></tr>`).join("")}</table></div>`;
        const sels = [...li.querySelectorAll("select")];
        sels.forEach(x => x.onchange = () => { x.classList.remove("ok", "bad"); save(); });
        ctrls.push({
          max: it.pairs.length, get: () => sels.map(x => x.value),
          grade() { let p = 0; sels.forEach((x, k) => { const ok = x.value === it.pairs[k][1]; p += ok ? 1 : 0; x.classList.toggle("ok", ok); x.classList.toggle("bad", !ok);
            x.closest("tr").querySelector(".mfb").textContent = ok ? "✓" : "→ " + it.pairs[k][1]; }); return p; },
          reveal() { sels.forEach((x, k) => { x.value = it.pairs[k][1]; x.classList.add("ok"); x.classList.remove("bad"); }); },
          clear() { sels.forEach(x => { x.value = ""; x.classList.remove("ok", "bad"); x.closest("tr").querySelector(".mfb").textContent = ""; }); },
          li, it
        });
      } else if (ex.type === "open") {
        li.innerHTML = `<span class="ilabel">${L[i] || i + 1}</span><div class="ibody"><div class="q">${esc(it.q)}</div><textarea rows="3" placeholder="${esc(T("yourAnswer"))}">${sv ? esc(sv) : ""}</textarea>
          ${it.sample ? `<details class="sample"><summary>${esc(T("showSample"))}</summary><p>${sayBtn(it.sample)} <span class="it">${esc(it.sample)}</span></p></details>` : ""}</div>`;
        const ta = li.querySelector("textarea");
        ta.addEventListener("focus", () => IG_ACCENT.attach(ta));
        ta.addEventListener("input", save);
        ctrls.push({ max: 0, get: () => ta.value, grade: () => 0, reveal() {}, clear() { ta.value = ""; }, li, it });
      }
      ol.appendChild(li);
    });

    function mark(inp, g) { inp.classList.remove("ok", "almost", "bad"); if (g === 1) inp.classList.add("ok"); else if (g === 0.5) inp.classList.add("almost"); else if (g === 0) inp.classList.add("bad"); }
    function save() { LS.set(akey, ctrls.map(c => c.get())); }
    el.addEventListener("input", e => { if (e.target.matches("input.blank")) { e.target.classList.remove("ok", "almost", "bad"); save(); } });
    el.querySelectorAll(".wb").forEach(b => b.onclick = () => {
      const t = lastInput || el.querySelector("input.blank:placeholder-shown, input.blank");
      if (t) { t.value = b.textContent; t.dispatchEvent(new Event("input", { bubbles: true })); const all = [...el.querySelectorAll("input.blank")]; const j = all.indexOf(t); if (all[j + 1]) all[j + 1].focus(); }
    });

    const maxPts = ctrls.reduce((a, c) => a + c.max, 0);
    function feedback(c, pts) {
      const fb = c.li.querySelector(".fb"); if (!fb) return;
      const it = c.it; let h = "";
      if (ex.type === "fill") {
        if (pts < c.max) h += `<span class="ans">${esc(T("answer"))}: <b>${it.a.map(a => esc(a.join(" / "))).join(" · ")}</b></span>`;
        if (pts === c.max) h += `<span class="okmsg">✓</span>`;
        else if (pts > 0 && pts % 1) h += ` <span class="almostmsg">${esc(T("almost"))}</span>`;
      }
      const say = it.say || (ex.type === "choice" ? null : null);
      if (say) h += ` ${sayBtn(say, "mini")} <span class="it small">${esc(say)}</span>`;
      if (it.tr) h += ` <span class="trl">${esc(C(it.tr))}</span>`;
      if (it.note) h += ` <span class="muted">(${esc(C(it.note))})</span>`;
      fb.innerHTML = h;
    }
    const resEl = el.querySelector(".result"), scEl = el.querySelector(".exscore");
    function showScore(p, revealed) {
      const pct = Math.round(100 * p / maxPts);
      resEl.innerHTML = revealed ? `<span class="muted">${esc(T("answer"))} ✓</span>` :
        `<b>${esc(T("score"))}: ${+p.toFixed(1)} / ${maxPts}</b> (${pct}%) ${pct === 100 ? "🎉 " + esc(T("perfect")) : pct >= 70 ? "👍" : "💪 " + esc(T("keepGoing"))}`;
      el.classList.toggle("perfect", pct === 100 && !revealed);
    }
    function paintBest() {
      const b = LS.get(key, null);
      scEl.innerHTML = b && b.max ? `<span class="pill ${b.best === b.max ? "full" : ""}">${esc(T("best"))} ${Math.round(100 * b.best / b.max)}%</span>` : "";
    }
    const ctrl = {
      el, max: maxPts,
      check() {
        if (!maxPts) return;
        let p = 0; ctrls.forEach(c => { const g = c.grade(); p += g; feedback(c, g); });
        const prev = LS.get(key, null);
        LS.set(key, { best: Math.max(p, prev ? prev.best : 0), last: p, max: maxPts });
        showScore(p, false); paintBest(); updateUnitScore(); save();
      },
      show() { ctrls.forEach(c => { c.reveal(); feedback(c, c.max); }); showScore(0, true); },
      retry() { ctrls.forEach(c => { c.clear(); const fb = c.li.querySelector(".fb"); if (fb) fb.innerHTML = ""; }); resEl.innerHTML = ""; el.classList.remove("perfect"); LS.del(akey); }
    };
    el.querySelectorAll("[data-act]").forEach(b => b.onclick = () => ctrl[b.dataset.act]());
    paintBest();
    return ctrl;
  }

  function updateUnitScore() {
    let got = 0, max = 0, done = 0, total = 0;
    const per = {};
    unitEx.forEach(x => {
      if (!x.max) return; total++;
      const parts = x.el.id.slice(2).split("-"); const secId = parts.slice(0, -1).join("-");
      per[secId] = per[secId] || { got: 0, max: 0 };
      const b = LS.get(exKey(uid, secId, parts[parts.length - 1]), null);
      if (b && b.max) { done++; got += b.best; max += b.max; per[secId].got += b.best; per[secId].max += b.max; }
    });
    const pct = max ? Math.round(100 * got / max) : 0;
    const f = document.getElementById("sbFill"), n = document.getElementById("sbNum");
    if (f) f.style.width = (total ? 100 * done / total : 0) + "%";
    if (f) f.style.setProperty("--q", pct);
    if (n) n.textContent = done ? `${done}/${total} · ${pct}%` : `0/${total}`;
    document.querySelectorAll(".toc a[data-sec]").forEach(a => { const p = per[a.dataset.sec]; a.querySelector(".tocsc").textContent = p && p.max ? Math.round(100 * p.got / p.max) + "%" : ""; });
  }

  function spy() {
    const links = [...document.querySelectorAll(".toc a[data-sec]")];
    const obs = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { links.forEach(l => l.classList.toggle("on", "s-" + l.dataset.sec === e.target.id)); }
    }), { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll(".sec").forEach(s => obs.observe(s));
  }
})();

/* Floating accent keyboard */
window.IG_ACCENT = (function () {
  let target = null, bar = null;
  const keys = ["à", "è", "é", "ì", "ò", "ù", "'", "À", "È"];
  function ensure() {
    if (bar) return;
    bar = document.createElement("div"); bar.className = "accentbar"; bar.hidden = true;
    bar.innerHTML = `<span>${IG.esc(IG.T("accentKeys"))}</span>` + keys.map(k => `<button type="button" tabindex="-1">${k}</button>`).join("");
    bar.addEventListener("mousedown", e => e.preventDefault());
    bar.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !target) return;
      const s = target.selectionStart ?? target.value.length, en = target.selectionEnd ?? s;
      target.value = target.value.slice(0, s) + b.textContent + target.value.slice(en);
      target.selectionStart = target.selectionEnd = s + 1; target.focus();
      target.dispatchEvent(new Event("input", { bubbles: true }));
    });
    document.body.appendChild(bar);
    document.addEventListener("focusout", () => setTimeout(() => { if (!document.activeElement || !document.activeElement.matches("input.blank, textarea")) bar.hidden = true; }, 120));
  }
  return { attach(el) { ensure(); target = el; bar.hidden = false; } };
})();
