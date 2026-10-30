// Thesis-Portal – Vorschau. Eine Datei fuer alle Seiten; jeder Teil
// prueft selbst, ob seine Seite geladen ist.
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function toast(text, ms) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(t._z);
    t._z = setTimeout(() => { t.hidden = true; }, ms || 2200);
  }

  async function kopieren(text, meldung) {
    try { await navigator.clipboard.writeText(text); toast(meldung || "Kopiert"); }
    catch (_) { toast(text, 7000); }
  }

  // ---- Allgemein ---------------------------------------------------------
  document.addEventListener("click", e => {
    const vh = e.target.closest("[data-vorschau-hinweis]");
    if (vh) { e.preventDefault(); toast(vh.dataset.vorschauHinweis, 5000); }
    const v = e.target.closest("[data-vorschau]");
    if (v) { e.preventDefault(); toast("Vorschau: Hier läge der Volltext. Die Beispielarbeiten haben keinen."); }
    const l = e.target.closest("[data-link-kopieren]");
    if (l) kopieren(new URL(l.dataset.linkKopieren, location.href).href, "Link zum Formular kopiert");
  });

  function zaehlerAnbinden(root) {
    $$("textarea[data-max]", root).forEach(feld => {
      const z = $(`[data-zaehler-fuer="${feld.id}"]`);
      if (!z) return;
      const max = Number(feld.dataset.max);
      const neu = () => {
        const n = feld.value.length;
        z.textContent = `${n.toLocaleString("de-DE")} / ${max.toLocaleString("de-DE")}`;
        z.classList.toggle("zuviel", n > max);
      };
      feld.addEventListener("input", neu);
      neu();
    });
  }
  zaehlerAnbinden(document);

  // Fenster „Volltext anfragen / Frage“ (Seite einer Arbeit) und
  // „Kontakt aufnehmen“ (Profilseite) – beide heissen #anfrage
  const dlg = $("#anfrage");
  function oeffnen(worum) {
    if (!dlg) return;
    const r = $(`input[name="worum"][value="${worum}"]`, dlg);
    if (r) r.checked = true;
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  $$("[data-dialog]").forEach(b => b.addEventListener("click", () => oeffnen(b.dataset.dialog)));
  if (location.hash === "#anfrage") oeffnen("volltext");
  if (location.hash === "#frage") oeffnen("frage");
  if (location.hash === "#kontakt") oeffnen("kontakt");

  // Seitenspalte wandert nur mit, wenn sie ganz in den Bildschirm passt
  // (Rueckmeldung Mariann Stegmaier, 28.10.2026)
  function spalteAnpassen() {
    $$(".seitenspalte:not(.lang), .klebt").forEach(s => {
      s.classList.remove("frei");
      s.classList.toggle("frei", s.getBoundingClientRect().height > window.innerHeight - 32);
    });
  }
  window.addEventListener("resize", spalteAnpassen);
  document.addEventListener("toggle", spalteAnpassen, true);
  spalteAnpassen();

  // Sprungliste: aktiven Abschnitt markieren
  const toc = $$(".toc a");
  if (toc.length && "IntersectionObserver" in window) {
    const ziele = toc.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
    const io = new IntersectionObserver(eintraege => {
      eintraege.forEach(en => {
        if (!en.isIntersecting) return;
        toc.forEach(a => a.classList.toggle("aktiv", a.hash === "#" + en.target.id));
      });
    }, { rootMargin: "0px 0px -70% 0px" });
    ziele.forEach(z => io.observe(z));
  }

  // ---- Liste der Arbeiten --------------------------------------------------
  const datenEl = $("#portal-daten");
  if (datenEl) liste(JSON.parse(datenEl.textContent));

  function falten(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
  }

  function liste(D) {
    const A = D.arbeiten, H = D.hubs;
    const form = $("#filter"), feld = $("#q"), sort = $("#sortierung");
    const GRUPPEN = ["art", "hub", "hs", "jahr", "ansatz", "daten", "volltext", "preis"];

    // Suchtext je Arbeit, in Woerter zerlegt. Kurze Suchwoerter (bis zwei
    // Zeichen) muessen ein ganzes Wort treffen, laengere einen Wortanfang:
    // „Hochschule C“ findet so nur Hochschule C, „Master“ die Masterarbeiten.
    A.forEach(w => {
      const text = [w.titel, w.namen, w.hs, w.sg, w.art, w.unterart || "", w.abschluss.slice(0, 4), w.abschluss_text,
        w.ansatz, w.daten.join(" "), w.hg, w.me, w.er, w.be, w.ergebnis, w.stw.join(" "),
        w.hubs.map(h => H[h].name).join(" "), w.preis ? "Nachwuchspreis DKVF" : ""].join(" ");
      w._woerter = falten(text).split(/[^a-z0-9]+/).filter(Boolean);
    });
    const werte = w => ({
      art: [w.art], hub: w.hubs, hs: [w.hs], jahr: [w.abschluss.slice(0, 4)], ansatz: [w.ansatz],
      daten: w.datenkat, volltext: [w.vt], preis: w.preis ? ["ja"] : []
    });

    function auswahl() {
      const s = {};
      GRUPPEN.forEach(g => { s[g] = $$(`input[name="${g}"]:checked`, form).map(i => i.value); });
      return s;
    }
    function passtSuche(w, tokens) {
      return tokens.every(t => t.length <= 2 ? w._woerter.includes(t) : w._woerter.some(x => x.startsWith(t)));
    }
    function passt(w, s, tokens, ausser) {
      const v = werte(w);
      for (const g of GRUPPEN) {
        if (g === ausser || !s[g].length) continue;
        if (!s[g].some(x => v[g].includes(x))) return false;
      }
      return passtSuche(w, tokens);
    }

    function karte(w) {
      const pillen = [`<span class="pille siegel">MVF-Edition Ausgezeichnet</span><span class="pille art">${esc(w.unterart ? w.art + " · " + w.unterart : w.art)}</span>`]
        .concat(w.hubs.map(h => `<span class="pille${H[h].krank ? " krank" : ""}">${esc(H[h].name)}</span>`))
        .concat(w.preis ? ['<span class="pille preis">Nachwuchspreis DKVF 2026</span>'] : []).join("");
      const seite = `arbeit/${w.nr}.html`;
      let voll;
      if (w.volltext === "pdf") voll = `<a class="knopf leise" href="#" data-vorschau>Volltext (PDF)</a>`;
      else if (w.volltext === "link") voll = `<a class="knopf leise" href="#" data-vorschau>Volltext bei der Hochschule ↗</a>`;
      else if (w.volltext === "anfrage") voll = `<a class="knopf leise" href="${seite}#anfrage">Volltext anfragen</a>`;
      else voll = `<span class="klein">Nur Kurzfassung (Sperrvermerk)</span>`;
      const stw = w.stw.map(s => `<li><a href="?q=${encodeURIComponent(s)}" data-stw="${esc(s)}">${esc(s)}</a></li>`).join("");
      const betreuung = w.betreuung.join(", ");
      return `<article class="karte">
  <div class="karte-oben"><div class="pillen">${pillen}</div><span class="datum">Abgeschlossen ${esc(w.abschluss_text)}</span></div>
  <h3><a href="${seite}">${esc(w.titel)}</a></h3>
  <p class="wer">${w.personen.map(p => `<a href="profil/${p.slug}.html">${esc(p.name)}</a>`).join(", ")} · ${esc(w.hs)} · ${esc(w.sg)}</p>
  <p class="ergebnis"><b>Ergebnis:</b> ${esc(w.ergebnis)}</p>
  <ul class="stichwoerter" aria-label="Stichwörter">${stw}</ul>
  <details><summary>Strukturierte Kurzfassung</summary>
    <div class="kf"><h4>Hintergrund und Fragestellung</h4><p>${esc(w.hg)}</p>
    <h4>Daten und Methode</h4><p>${esc(w.me)}</p>
    <h4>Ergebnisse</h4><p>${esc(w.er)}</p>
    <h4>Bedeutung für die Versorgung</h4><p>${esc(w.be)}</p></div>
    <p style="margin:12px 0 0"><a class="knopf leise" href="${seite}">Zur ganzen Seite der Arbeit →</a></p>
  </details>
  <p class="meta-zeile">DOI ${esc(w.doi)} · Betreuung: ${esc(betreuung)}</p>
  <div class="knopfreihe"><button class="knopf" type="button" data-zitat="${esc(w.nr)}">Zitieren</button>${voll}</div>
</article>`;
    }

    function zeigen() {
      const s = auswahl();
      const tokens = falten(feld.value).split(/[^a-z0-9]+/).filter(Boolean);
      let treffer = A.filter(w => passt(w, s, tokens));
      const art = sort.value;
      treffer.sort((x, y) => art === "titel" ? x.titel.localeCompare(y.titel, "de")
        : art === "portal" ? y.seit.localeCompare(x.seit) || y.nr.localeCompare(x.nr)
          : y.abschluss.localeCompare(x.abschluss) || x.titel.localeCompare(y.titel, "de"));
      $("#liste").innerHTML = treffer.length ? treffer.map(karte).join("")
        : '<div class="leer-hinweis">Keine Arbeit passt zu dieser Auswahl. <button class="knopf leise" type="button" id="leer-zurueck">Filter zurücksetzen</button></div>';
      $("#treffer").textContent = treffer.length === A.length ? `${A.length} Arbeiten` : `${treffer.length} von ${A.length} Arbeiten`;
      // Zahlen je Option: wie viele Arbeiten es mit dieser Option gaebe
      GRUPPEN.forEach(g => {
        const basis = A.filter(w => passt(w, s, tokens, g));
        $$(`input[name="${g}"]`, form).forEach(i => {
          const n = basis.filter(w => werte(w)[g].includes(i.value)).length;
          const z = $(`[data-n="${g}|${CSS.escape(i.value)}"]`, form);
          if (z) z.textContent = n;
          i.closest(".wahl").classList.toggle("leer", n === 0 && !i.checked);
        });
      });
      GRUPPEN.forEach(g => {
        const sum = $(`[data-zusammenfassung="${g}"]`, form);
        const gew = $$(`input[name="${g}"]:checked`, form).length;
        if (sum) sum.textContent = gew ? ` · ${gew} gewählt` : "";
      });
      spalteAnpassen();
      const url = new URL(location.href);
      if (feld.value.trim()) url.searchParams.set("q", feld.value.trim()); else url.searchParams.delete("q");
      history.replaceState(null, "", url);
    }

    function zuruecksetzen() {
      $$("input:checked", form).forEach(i => { i.checked = false; });
      feld.value = "";
      zeigen();
    }

    const q = new URLSearchParams(location.search).get("q");
    if (q) feld.value = q;
    form.addEventListener("change", zeigen);
    feld.addEventListener("input", zeigen);
    sort.addEventListener("change", zeigen);
    $("#zuruecksetzen").addEventListener("click", zuruecksetzen);
    $("#liste").addEventListener("click", e => {
      if (e.target.id === "leer-zurueck") zuruecksetzen();
      const s = e.target.closest("[data-stw]");
      if (s) { e.preventDefault(); feld.value = s.dataset.stw; zeigen(); feld.scrollIntoView({ block: "center" }); }
      const z = e.target.closest("[data-zitat]");
      if (z) { const w = A.find(x => x.nr === z.dataset.zitat); kopieren(w.zitat, "Zitierangabe kopiert (Vancouver)"); }
    });
    zeigen();
  }

  // ---- Profile ------------------------------------------------------------
  const profilEl = $("#profil-daten");
  if (profilEl) profilListe(JSON.parse(profilEl.textContent));

  function profilListe(D) {
    const form = $("#pfilter"), feld = $("#pq");
    const P = D.profile, H = D.hubs;
    P.forEach(p => {
      p._themen = [...new Set(p.arbeiten.flatMap(a => a.hubs))];
      p._woerter = falten([p.name, p.status, p.kurz, p.sucht, p.schwerpunkte.join(" "), p.methoden.join(" "),
        p.arbeiten.map(a => a.titel + " " + a.art).join(" "), p._themen.map(h => H[h].name).join(" ")].join(" "))
        .split(/[^a-z0-9]+/).filter(Boolean);
    });
    const kat = p => ({ offen: D.gruppen.map(g => g.k).filter(k => p.kontakt[k]), thema: p._themen });
    function auswahl() {
      return { offen: $$('input[name="offen"]:checked', form).map(i => i.value), thema: $$('input[name="thema"]:checked', form).map(i => i.value) };
    }
    function passt(p, s, tokens, ausser) {
      const k = kat(p);
      for (const g of ["offen", "thema"]) {
        if (g === ausser || !s[g].length) continue;
        if (!s[g].some(x => k[g].includes(x))) return false;
      }
      return tokens.every(t => t.length <= 2 ? p._woerter.includes(t) : p._woerter.some(x => x.startsWith(t)));
    }
    function karte(p) {
      const offen = D.gruppen.filter(g => p.kontakt[g.k]);
      const kontakt = offen.length
        ? `<ul class="kontaktwunsch kompakt" aria-label="Offen für Kontakt durch">${offen.map(g => `<li class="kontakt-ja">${esc(g.t)} <span class="zeichen" aria-hidden="true">✓</span></li>`).join("")}</ul>`
        : '<p class="keiner">Derzeit kein Kontakt gewünscht</p>';
      const arb = p.arbeiten.map(a => `<a href="arbeit/${a.nr}.html">${esc(a.art)}</a>`).join(", ");
      return `<article class="profilkarte">
  <div class="kopf"><span class="avatar klein" aria-hidden="true">${esc(p.initialen)}</span>
    <div><h3><a href="profil/${p.slug}.html">${esc(p.name)}</a></h3><p class="status">${esc(p.status)}</p></div></div>
  <p class="kurz">${esc(p.kurz)}</p>
  ${p.sucht ? `<p class="arbeit-zeile"><b>Sucht:</b> ${esc(p.sucht)}</p>` : ""}
  <p class="arbeit-zeile">Im Portal: ${arb}</p>
  ${kontakt}
</article>`;
    }
    function zeigen() {
      const s = auswahl();
      const tokens = falten(feld.value).split(/[^a-z0-9]+/).filter(Boolean);
      const treffer = P.filter(p => passt(p, s, tokens));
      $("#profilliste").innerHTML = treffer.length ? treffer.map(karte).join("")
        : '<div class="leer-hinweis">Kein Profil passt zu dieser Auswahl.</div>';
      $("#p-treffer").textContent = treffer.length === P.length ? `${P.length} Profile` : `${treffer.length} von ${P.length} Profilen`;
      ["offen", "thema"].forEach(g => {
        const basis = P.filter(p => passt(p, s, tokens, g));
        $$(`input[name="${g}"]`, form).forEach(i => {
          const n = basis.filter(p => kat(p)[g].includes(i.value)).length;
          const z = $(`[data-n="${g}|${i.value}"]`, form);
          if (z) z.textContent = n;
          i.closest(".wahl").classList.toggle("leer", n === 0 && !i.checked);
        });
      });
      const sum = $('[data-zusammenfassung="thema"]', form);
      const gew = $$('input[name="thema"]:checked', form).length;
      sum.textContent = gew ? `${gew} gewählt` : "Alle Themen";
    }
    form.addEventListener("change", zeigen);
    feld.addEventListener("input", zeigen);
    $("#p-zurueck").addEventListener("click", () => { $$("input:checked", form).forEach(i => { i.checked = false; }); feld.value = ""; zeigen(); });
    zeigen();
  }

  // ---- Seite einer Arbeit -------------------------------------------------
  const arbeitEl = $("#arbeit-daten");
  if (arbeitEl) arbeitSeite(JSON.parse(arbeitEl.textContent));

  function arbeitSeite(w) {
    $$("[data-kopieren]").forEach(b => b.addEventListener("click", () =>
      kopieren($("#" + b.dataset.kopieren).textContent, "Zitierangabe kopiert")));

    const jahr = w.abschluss.slice(0, 4);
    const typ = w.art === "Dissertation" ? "phdthesis" : w.art === "Weitere Arbeit" ? "misc" : "mastersthesis";
    const autorenBib = w.autoren.map(a => `${a.nach}, ${a.vor}`).join(" and ");
    const schluessel = (w.autoren[0].nach + jahr + w.nr.slice(-3)).replace(/[^A-Za-z0-9]/g, "");
    const bibtex = `@${typ}{${schluessel},
  author = {${autorenBib}},
  title = {${w.titel}},
  school = {${w.hs}},
  year = {${jahr}},
  type = {${w.unterart || w.art}},
  doi = {${w.doi}},
  note = {Kurzfassung in der MVF-Edition Ausgezeichnet · Gesundheitsversorgung (Monitor Versorgungsforschung, in Kooperation mit dem DNVF)}
}
`;
    const ris = ["TY  - " + (w.art === "Dissertation" || w.art.endsWith("arbeit") ? "THES" : "GEN")]
      .concat(w.autoren.map(a => `AU  - ${a.nach}, ${a.vor}`))
      .concat([`TI  - ${w.titel}`, `PB  - ${w.hs}`, `PY  - ${jahr}`, `M3  - ${w.unterart || w.art}`,
        `DO  - ${w.doi}`, `AB  - ${w.ergebnis}`].concat(w.stw.map(s => `KW  - ${s}`)), ["ER  - ", ""]).join("\r\n");
    $$("[data-export]").forEach(b => b.addEventListener("click", () => {
      const istBib = b.dataset.export === "bibtex";
      const blob = new Blob([istBib ? bibtex : ris], { type: istBib ? "application/x-bibtex" : "application/x-research-info-systems" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `edition-${w.nr}.${istBib ? "bib" : "ris"}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }));
  }

  // ---- Einreichen ---------------------------------------------------------
  const formE = $("#einreichung");
  if (formE) einreichen(formE);

  function einreichen(form) {
    const SCHLUESSEL = "edition-vorschau-einreichung";
    const box = $("#autoren");
    let nAutoren = 0;
    function autorHinzu(daten) {
      if (nAutoren >= 10) { toast("Höchstens 10 Autor:innen"); return; }
      nAutoren += 1;
      const n = nAutoren;
      const div = document.createElement("div");
      div.className = "autor";
      div.innerHTML = `<div class="autor-kopf"><span>Autor:in ${n}${n === 1 ? " (Sie)" : ""}</span>${n > 1 ? '<button type="button">Entfernen</button>' : ""}</div>
  <div class="reihe"><div class="feld"><label for="au${n}v">Vorname <span class="pflicht">*</span></label><input id="au${n}v" type="text" data-speichern></div>
  <div class="feld"><label for="au${n}n">Nachname <span class="pflicht">*</span></label><input id="au${n}n" type="text" data-speichern></div></div>
  <div class="reihe"><div class="feld"><label for="au${n}m">E-Mail-Adresse <span class="pflicht">*</span></label><input id="au${n}m" type="email" data-speichern>
  <span class="hilfe">${n === 1 ? "Wird nicht veröffentlicht. Über sie erreichen Sie Anfragen zum Volltext." : "Bekommt eine E-Mail und stimmt der Einreichung zu."}</span></div>
  <div class="feld"><label for="au${n}o">ORCID (freiwillig)</label><input id="au${n}o" type="text" placeholder="0000-0000-0000-0000" data-speichern>
  <span class="hilfe">Erscheint als Symbol neben dem Namen.</span></div></div>`;
      box.appendChild(div);
      const weg = $("button", div);
      if (weg) weg.addEventListener("click", () => { div.remove(); nummerieren(); speichern(); });
      if (daten) ["v", "n", "m", "o"].forEach((k, i) => { $$("input", div)[i].value = daten[k] || ""; });
    }
    function nummerieren() {
      const alle = $$(".autor", box);
      nAutoren = alle.length;
      alle.forEach((d, i) => { $(".autor-kopf span", d).textContent = `Autor:in ${i + 1}${i === 0 ? " (Sie)" : ""}`; });
    }
    $("#autor-plus").addEventListener("click", () => { autorHinzu(); speichern(); });

    const art = $("#e-art"), unter = $("#unterart-feld");
    const artNeu = () => { unter.hidden = art.value !== "Weitere Arbeit"; };
    art.addEventListener("change", artNeu);

    const hs = $("#e-hs"), hsA = $("#e-hs-andere");
    hs.addEventListener("change", () => { hsA.hidden = hs.value !== "andere"; });

    const hubZ = $("#hub-zaehler");
    function hubsNeu(e) {
      const gew = $$('input[name="e-hub"]:checked', form);
      if (gew.length > 3 && e) { e.target.checked = false; toast("Bitte höchstens drei Knowledge-Hubs wählen"); }
      const n = $$('input[name="e-hub"]:checked', form).length;
      hubZ.textContent = `${n} von 3 gewählt`;
    }
    $$('input[name="e-hub"]', form).forEach(i => i.addEventListener("change", hubsNeu));

    const ethik = $("#e-ethik"), ethikL = $("#e-ethik-label"), ethikT = $("#e-ethik-text");
    const ethikNeu = () => {
      const liegt = ethik.value === "liegt";
      ethikL.firstChild.textContent = liegt ? "Ethikkommission " : "Begründung ";
      ethikT.placeholder = liegt ? "z. B. Ethikkommission der Universität A" : "z. B. anonymisierte Sekundärdaten";
    };
    ethik.addEventListener("change", ethikNeu);

    const probe = $("#e-probe"), studabo = $("#e-studabo"), aboFelder = $("#abo-felder");
    const aboNeu = () => { aboFelder.hidden = !(probe.checked || studabo.checked); };
    probe.addEventListener("change", aboNeu);
    studabo.addEventListener("change", aboNeu);

    const profilJa = $("#e-profil"), profilFelder = $("#profil-felder");
    const profilNeu = () => { profilFelder.hidden = !profilJa.checked; };
    profilJa.addEventListener("change", profilNeu);

    const andereDaten = $('input[name="e-daten"][value="Andere"]', form), andereT = $("#e-daten-andere");
    andereDaten.addEventListener("change", () => { andereT.hidden = !andereDaten.checked; });

    const stw = $("#e-stw"), stwZ = $("#stw-zaehler");
    const stwNeu = () => {
      const n = stw.value.split(",").map(s => s.trim()).filter(Boolean).length;
      stwZ.textContent = `${n} / 5`;
      stwZ.classList.toggle("zuviel", n > 5);
    };
    stw.addEventListener("input", stwNeu);

    const wege = $("#volltext-wege"), pdf = $("#e-pdf"), link = $("#e-link");
    function volltextNeu() {
      const gesperrt = $('input[name="e-sperre"]:checked', form).value === "ja";
      wege.hidden = gesperrt;
      const weg = ($('input[name="e-voll"]:checked', form) || {}).value;
      pdf.hidden = weg !== "pdf";
      link.hidden = weg !== "link";
    }
    $$('input[name="e-sperre"], input[name="e-voll"]', form).forEach(i => i.addEventListener("change", volltextNeu));

    // Zwischenstand im Browser (nur in diesem Browser; scheitert still,
    // wenn der Speicher gesperrt ist)
    function felder() { return $$("input, select, textarea", form).filter(f => f.type !== "file" && f.type !== "submit"); }
    function speichern() {
      const daten = { autoren: $$(".autor", box).map(d => { const i = $$("input", d); return { v: i[0].value, n: i[1].value, m: i[2].value, o: i[3].value }; }), f: {} };
      felder().forEach((f, k) => {
        if (f.closest(".autor")) return;
        const id = f.id || `${f.name}|${f.value}|${k}`;
        daten.f[id] = (f.type === "checkbox" || f.type === "radio") ? f.checked : f.value;
      });
      try {
        localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
        const t = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        $("#speicherstand").textContent = `Automatisch in diesem Browser gespeichert, zuletzt um ${t} Uhr.`;
      } catch (_) {
        $("#speicherstand").textContent = "Zwischenspeichern ist in diesem Browser nicht möglich.";
      }
    }
    function laden() {
      let daten = null;
      try { daten = JSON.parse(localStorage.getItem(SCHLUESSEL) || "null"); } catch (_) { daten = null; }
      if (daten && daten.autoren && daten.autoren.length) daten.autoren.forEach(a => autorHinzu(a));
      else autorHinzu();
      if (!daten) return;
      felder().forEach((f, k) => {
        if (f.closest(".autor")) return;
        const id = f.id || `${f.name}|${f.value}|${k}`;
        if (!(id in daten.f)) return;
        if (f.type === "checkbox" || f.type === "radio") f.checked = daten.f[id]; else f.value = daten.f[id];
      });
      $("#speicherstand").textContent = "Ihr letzter Zwischenstand wurde wiederhergestellt.";
    }
    laden();
    artNeu(); hubsNeu(); ethikNeu(); volltextNeu(); stwNeu(); profilNeu(); aboNeu();
    hsA.hidden = hs.value !== "andere"; andereT.hidden = !andereDaten.checked;
    zaehlerAnbinden(form);
    let warte;
    form.addEventListener("input", () => { clearTimeout(warte); warte = setTimeout(speichern, 600); });
    form.addEventListener("change", speichern);
  }
})();
