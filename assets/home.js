(function () {
  const { T, C, esc, unitStats } = IG;
  IG.header("home");
  const cat = window.CATALOG || [];
  const main = document.getElementById("main");
  const chapters = ["1", "2", "3", "4", "5", "6", "7", "VT"];
  const icons = { "1": "🏃", "2": "🏷️", "3": "👉", "4": "🎨", "5": "⚡", "6": "📍", "7": "🔗", "VT": "📚" };

  let tDone = 0, tTotal = 0, sum = 0, n = 0;
  cat.forEach(u => { const s = unitStats(u); tDone += s.done; tTotal += s.total; if (s.avg != null) { sum += s.avg * s.done; n += s.done; } });
  const totalItems = cat.reduce((a, u) => a + u.nItems, 0), totalEx = cat.reduce((a, u) => a + u.nEx, 0);

  main.innerHTML = `
    <section class="hero">
      <div class="hero-txt">
        <p class="kicker">Italiano · A1–B1</p>
        <h1>${esc(T("siteTitle"))}</h1>
        <p class="sub">${esc(T("siteSub"))}</p>
        <div class="herostats">
          <div><b>${cat.length}</b><span>${esc(T("units"))}</span></div>
          <div><b>${totalEx}</b><span>${esc(T("exercises"))}</span></div>
          <div><b>${totalItems}</b><span>${esc(T("items"))}</span></div>
        </div>
      </div>
      <div class="progresscard">
        <h3>${esc(T("progress"))}</h3>
        <div class="ring" style="--p:${tTotal ? Math.round(100 * tDone / tTotal) : 0}"><span>${tTotal ? Math.round(100 * tDone / tTotal) : 0}%</span></div>
        <p><b>${tDone}</b> / ${tTotal} ${esc(T("exercisesDone"))}</p>
        <p>${esc(T("avgScore"))}: <b>${n ? Math.round(sum / n) + "%" : "–"}</b></p>
      </div>
    </section>
    <div class="searchbox"><input id="q" type="search" placeholder="${esc(T("search"))}" autocomplete="off"><div id="results" class="results"></div></div>
    <div id="chapters"></div>`;

  const wrap = document.getElementById("chapters");
  chapters.forEach(ch => {
    const units = cat.filter(u => u.chapter === ch);
    if (!units.length) return;
    const sec = document.createElement("section");
    sec.className = "chapter";
    sec.innerHTML = `<h2><span class="chicon">${icons[ch]}</span>${ch === "VT" ? "" : `<span class="chno">${ch}</span>`} ${esc(T("ch" + ch))}</h2><div class="cards">${units.map(card).join("")}</div>`;
    wrap.appendChild(sec);
  });

  function card(u) {
    const s = unitStats(u);
    const pct = s.total ? Math.round(100 * s.done / s.total) : 0;
    const label = s.done === 0 ? T("start") : s.done < s.total ? T("continue") : T("review");
    return `<a class="card" href="unit.html?u=${encodeURIComponent(u.unit)}">
      <div class="cardtop"><span class="uid">${esc(u.unit === "VT" ? "📚" : u.unit)}</span>${s.avg != null ? `<span class="pill ${s.avg === 100 ? "full" : ""}">${s.avg}%</span>` : ""}</div>
      <h3>${esc(C(u.title))}</h3>
      <p class="desc">${esc(C(u.summary))}</p>
      <ul class="subs">${u.sections.slice(0, 6).map(x => `<li>${esc(C(x.title))}</li>`).join("")}${u.sections.length > 6 ? `<li>…</li>` : ""}</ul>
      <div class="cardfoot"><span>${u.nEx ? `${u.nEx} ${esc(T("exercises"))} · ${u.nItems} ${esc(T("items"))}` : esc(T("tables"))}</span><span class="go">${esc(label)} →</span></div>
      ${s.total ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ""}
    </a>`;
  }

  const q = document.getElementById("q"), res = document.getElementById("results");
  const strip = x => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const index = [];
  cat.forEach(u => u.sections.forEach(s => index.push({ u, s, hay: strip([s.id, s.title.en, s.title.ko, s.kw || "", u.title.en, u.title.ko].join(" ")) })));
  q.oninput = () => {
    const v = strip(q.value.trim());
    if (!v) { res.innerHTML = ""; return; }
    const words = v.split(/\s+/);
    const hits = index.filter(x => words.every(w => x.hay.includes(w))).slice(0, 12);
    res.innerHTML = hits.length ? hits.map(x => `<a href="unit.html?u=${encodeURIComponent(x.u.unit)}#s-${encodeURIComponent(x.s.id)}"><span class="sid">${esc(x.s.id)}</span> ${esc(C(x.s.title))} <small>${esc(C(x.u.title))}</small></a>`).join("") : `<p class="empty">${esc(T("noResults"))}</p>`;
  };
  document.getElementById("foot").textContent = T("footer");
})();
