/* Shared core: language, storage, audio, header. */
(function () {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    keys(prefix) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch (e) {} return out; }
  };

  function detectLang() {
    const saved = LS.get("ig:lang", null);
    if (saved && I18N.t[saved]) return saved;
    const nav = (navigator.languages || [navigator.language || "en"]).map(l => (l || "").slice(0, 2).toLowerCase());
    for (const l of nav) if (I18N.t[l]) return l;
    return "en";
  }
  let lang = detectLang();

  const T = k => (I18N.t[lang] && I18N.t[lang][k]) || I18N.t.en[k] || k;
  // content text: {en, ko} -> current lang (Korean only for ko, English otherwise)
  const C = v => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    return v[lang] || (lang === "ko" ? v.ko : null) || v.en || v.ko || "";
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  /* ---------- audio ---------- */
  function normSay(s) { return String(s).normalize("NFC").replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim(); }
  function fnv(str, seed) {
    let h = seed >>> 0;
    const bytes = new TextEncoder().encode(str);
    for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  function audioId(s) { const n = normSay(s); return fnv(n, 2166136261) + fnv(n, 0x811c9dc5 ^ 0x5bd1e995); }

  const audioPrefs = LS.get("ig:audio", { mode: "rec", rate: 1 });
  let current = null;
  let itVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    const vs = speechSynthesis.getVoices().filter(v => /^it([-_]|$)/i.test(v.lang));
    if (!vs.length) return null;
    const score = v => {
      const n = v.name.toLowerCase(); let s = 0;
      if (/natural|neural|online/.test(n)) s += 50;
      if (/premium|enhanced|siri/.test(n)) s += 40;
      if (/google/.test(n)) s += 30;
      if (/isabella|elsa|diego|alice|federica|luca|paola/.test(n)) s += 10;
      if (/it-it|it_it/i.test(v.lang)) s += 5;
      return s;
    };
    return vs.sort((a, b) => score(b) - score(a))[0];
  }
  if ("speechSynthesis" in window) { itVoice = pickVoice(); speechSynthesis.onvoiceschanged = () => { itVoice = pickVoice(); }; }

  function speakDevice(text, btn) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT"; if (itVoice) u.voice = itVoice;
    u.rate = 0.95 * (audioPrefs.rate || 1);
    if (btn) { btn.classList.add("playing"); u.onend = u.onerror = () => btn.classList.remove("playing"); }
    speechSynthesis.speak(u);
  }
  function play(text, btn) {
    if (!text) return;
    if (current) { current.pause(); document.querySelectorAll(".playing").forEach(b => b.classList.remove("playing")); }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    const id = audioId(text);
    const hasRec = window.AUDIO_IDX && window.AUDIO_IDX[id];
    if (audioPrefs.mode === "rec" && hasRec) {
      const a = new Audio("audio/" + id.slice(0, 2) + "/" + id + ".mp3");
      a.playbackRate = audioPrefs.rate || 1;
      a.preservesPitch = true;
      current = a;
      if (btn) { btn.classList.add("playing"); a.onended = a.onerror = () => btn.classList.remove("playing"); }
      a.onerror = () => { if (btn) btn.classList.remove("playing"); speakDevice(text, btn); };
      a.play().catch(() => speakDevice(text, btn));
    } else speakDevice(text, btn);
  }
  function sayBtn(text, cls) {
    if (!text) return "";
    return `<button class="say ${cls || ""}" type="button" data-say="${esc(text)}" title="${esc(T("listen"))}" aria-label="${esc(T("listen"))}">🔊</button>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-say]");
    if (b) { e.preventDefault(); play(b.getAttribute("data-say"), b); }
  });

  /* ---------- header ---------- */
  function header(active) {
    const h = document.getElementById("topbar");
    if (!h) return;
    const opts = I18N.langs.map(([c, n]) => `<option value="${c}" ${c === lang ? "selected" : ""}>${n}</option>`).join("");
    h.innerHTML = `
      <a class="brand" href="index.html"><span class="flag"><i></i><i></i><i></i></span><span>Grammatica <b>Italiana</b></span></a>
      <nav class="topnav">
        <a href="index.html" class="${active === "home" ? "on" : ""}">${esc(T("home"))}</a>
        <button type="button" id="audioBtn" class="iconbtn" aria-haspopup="true">🎧 <span>${esc(T("audioSettings"))}</span></button>
        <label class="langsel">🌐<select id="langSel" aria-label="Language">${opts}</select></label>
      </nav>
      <div id="audioPanel" class="audiopanel" hidden>
        <div class="row"><b>${esc(T("voice"))}</b></div>
        <label class="row"><input type="radio" name="am" value="rec" ${audioPrefs.mode === "rec" ? "checked" : ""}> ${esc(T("voiceRec"))}</label>
        <label class="row"><input type="radio" name="am" value="dev" ${audioPrefs.mode === "dev" ? "checked" : ""}> ${esc(T("voiceBrowser"))} <small id="devName"></small></label>
        <div class="row"><b>${esc(T("speed"))}</b>
          <select id="rateSel">${[0.7, 0.85, 1, 1.15].map(r => `<option value="${r}" ${r == (audioPrefs.rate || 1) ? "selected" : ""}>${r}×</option>`).join("")}</select>
          <button type="button" class="btn small" data-say="Buongiorno! Benvenuti alla lezione di italiano.">${esc(T("testVoice"))} 🔊</button>
        </div>
      </div>`;
    document.getElementById("langSel").onchange = e => { LS.set("ig:lang", e.target.value); location.reload(); };
    const panel = document.getElementById("audioPanel");
    document.getElementById("audioBtn").onclick = () => {
      panel.hidden = !panel.hidden;
      const dn = document.getElementById("devName"); itVoice = pickVoice() || itVoice;
      dn.textContent = itVoice ? "(" + itVoice.name + ")" : "";
    };
    panel.querySelectorAll("input[name=am]").forEach(r => r.onchange = () => { audioPrefs.mode = r.value; LS.set("ig:audio", audioPrefs); });
    document.getElementById("rateSel").onchange = e => { audioPrefs.rate = parseFloat(e.target.value); LS.set("ig:audio", audioPrefs); };
    document.addEventListener("click", e => { if (!panel.hidden && !e.target.closest("#audioPanel,#audioBtn")) panel.hidden = true; });
    document.documentElement.lang = lang;
  }

  /* ---------- scores ---------- */
  function exKey(unit, sec, ex) { return `ig:s:${unit}|${sec}|${ex}`; }
  function unitStats(u) {
    let done = 0, sum = 0, total = 0;
    (u.exlist || []).forEach(k => {
      total++;
      const s = LS.get(exKey(u.unit, k[0], k[1]), null);
      if (s && s.max) { done++; sum += s.best / s.max; }
    });
    return { done, total, avg: done ? Math.round(100 * sum / done) : null };
  }

  window.IG = { LS, T, C, esc, lang: () => lang, play, sayBtn, audioId, header, exKey, unitStats };
})();
