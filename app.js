// Bargeld-App – Logik (ohne Build-Schritt, läuft direkt auf GitHub Pages)

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
const TABLE = "ausgaben";
const CAT_KEY = "bargeld.kategorien";
const DEMO_KEY = "bargeld.demo";
const DEFAULT_CATS = ["Lebensmittel", "Essen & Trinken", "Verkehr", "Freizeit", "Haushalt", "Sonstiges"];

const cfg = window.BARGELD_CONFIG || {};
const configured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY);

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const $ = (sel) => document.querySelector(sel);

// ---------- Hilfen: Datum & Betrag ----------

function isoDate(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function parseIso(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function daysBetween(a, b) {
  return Math.round((parseIso(b) - parseIso(a)) / 86400000);
}
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function formatDay(iso) {
  const today = isoDate();
  if (iso === today) return "Heute";
  if (iso === isoDate(addDays(new Date(), -1))) return "Gestern";
  return parseIso(iso).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

/** "12,50" / "12.5" / "3" → Zahl; ungültig, 0 oder negativ → null */
function parseBetrag(text) {
  const t = String(text).trim().replace(/[\s€]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n < 1_000_000 ? n : null;
}
function betragToInput(n) {
  return Number(n).toFixed(2).replace(".", ",");
}
const sum = (list) => list.reduce((s, e) => s + Number(e.betrag), 0);

// ---------- Datenzugriff ----------

async function createSupabaseDb() {
  const { createClient } = await import(SUPABASE_CDN);
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const ok = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    async list() {
      const all = [];
      for (let from = 0; ; from += 1000) {
        const rows = ok(
          await sb.from(TABLE).select("*")
            .order("datum", { ascending: false })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, from + 999),
        );
        all.push(...rows);
        if (rows.length < 1000) return all;
      }
    },
    add: async (e) => ok(await sb.from(TABLE).insert(e).select().single()),
    update: async (id, e) => ok(await sb.from(TABLE).update(e).eq("id", id).select().single()),
    remove: async (id) => { ok(await sb.from(TABLE).delete().eq("id", id)); },
  };
}

function createDemoDb() {
  const load = () => {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || []; } catch { return []; }
  };
  const save = (rows) => localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  return {
    async list() {
      return load().sort((a, b) => b.datum.localeCompare(a.datum) || b.created_at.localeCompare(a.created_at));
    },
    async add(e) {
      const rows = load();
      const row = { id: Date.now(), created_at: new Date().toISOString(), ...e };
      rows.push(row);
      save(rows);
      return row;
    },
    async update(id, e) {
      const rows = load().map((r) => (r.id === id ? { ...r, ...e } : r));
      save(rows);
      return rows.find((r) => r.id === id);
    },
    async remove(id) { save(load().filter((r) => r.id !== id)); },
  };
}

// ---------- Kategorien (lokal auf dem Gerät) ----------

function loadCats() {
  try {
    const c = JSON.parse(localStorage.getItem(CAT_KEY));
    if (Array.isArray(c) && c.length) return c;
  } catch { /* Standard nutzen */ }
  return [...DEFAULT_CATS];
}
function saveCats() {
  try { localStorage.setItem(CAT_KEY, JSON.stringify(state.cats)); } catch { /* egal */ }
}

// ---------- Zustand & Navigation ----------

const state = {
  db: null,
  entries: [],
  loaded: false,
  cats: loadCats(),
  editing: null,     // Eintrag, der gerade bearbeitet wird
  stack: ["home"],   // Bildschirm-Verlauf für "Zurück"
  photoUrl: null,
};

function show(name) {
  document.querySelectorAll(".screen").forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
  window.scrollTo(0, 0);
  if (name === "home") renderHome();
  if (name === "stats") renderStats();
  if (name === "history") renderHistory();
  if (name === "settings") renderSettings();
}
function go(name) {
  state.stack.push(name);
  show(name);
}
function back() {
  if (state.stack.length > 1) state.stack.pop();
  show(state.stack[state.stack.length - 1]);
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("err", isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 5000 : 2200);
}

async function reload() {
  try {
    state.entries = await state.db.list();
    state.loaded = true;
  } catch (err) {
    toast(`Laden fehlgeschlagen: ${err.message}`, true);
  }
}

// ---------- Start ----------

function weekEntries() {
  const mon = isoDate(mondayOf(new Date()));
  const sun = isoDate(addDays(mondayOf(new Date()), 6));
  return state.entries.filter((e) => e.datum >= mon && e.datum <= sun);
}
function renderHome() {
  $("#home-week").textContent = state.loaded ? euro.format(sum(weekEntries())) : "–";
}

// ---------- Eintrag-Formular ----------

function renderCatChips(selected) {
  const box = $("#f-kategorien");
  const cats = [...state.cats];
  if (selected && !cats.includes(selected)) cats.push(selected);
  box.replaceChildren(...cats.map((c) => {
    const label = document.createElement("label");
    label.className = "chip";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "kategorie";
    input.value = c;
    input.checked = c === selected;
    const span = document.createElement("span");
    span.textContent = c;
    label.append(input, span);
    return label;
  }));
}

function openEntry(entry = null, { photoFile = null } = {}) {
  state.editing = entry;
  $("#entry-title").textContent = entry ? "Ausgabe bearbeiten" : photoFile ? "Kassenbon" : "Ausgabe eintragen";
  $("#f-betrag").value = entry ? betragToInput(entry.betrag) : "";
  $("#f-datum").value = entry ? entry.datum : isoDate();
  $("#f-notiz").value = entry ? entry.notiz || "" : photoFile ? "Kassenbon" : "";
  renderCatChips(entry ? entry.kategorie : state.cats[0]);
  $("#f-error").hidden = true;
  $("#f-delete").hidden = !entry;

  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = photoFile ? URL.createObjectURL(photoFile) : null;
  $("#entry-photo").hidden = !photoFile;
  if (photoFile) $("#entry-photo img").src = state.photoUrl;

  go("entry");
  if (!entry && !photoFile) $("#f-betrag").focus();
}

async function saveEntry(ev) {
  ev.preventDefault();
  const betrag = parseBetrag($("#f-betrag").value);
  if (betrag === null) {
    const err = $("#f-error");
    err.textContent = "Bitte einen gültigen Betrag eingeben, z. B. 12,50.";
    err.hidden = false;
    $("#f-betrag").focus();
    return;
  }
  const checked = document.querySelector('input[name="kategorie"]:checked');
  const data = {
    betrag,
    datum: $("#f-datum").value || isoDate(),
    kategorie: checked ? checked.value : null,
    notiz: $("#f-notiz").value.trim() || null,
  };
  const btn = $("#f-save");
  btn.disabled = true;
  try {
    if (state.editing) await state.db.update(state.editing.id, data);
    else await state.db.add(data);
    await reload();
    toast(state.editing ? "Änderung gespeichert" : `${euro.format(betrag)} gespeichert`);
    back();
  } catch (err) {
    toast(`Speichern fehlgeschlagen: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

async function deleteEntry(entry) {
  const text = `${euro.format(entry.betrag)} vom ${parseIso(entry.datum).toLocaleDateString("de-DE")} wirklich löschen?`;
  if (!confirm(text)) return false;
  try {
    await state.db.remove(entry.id);
    await reload();
    toast("Eintrag gelöscht");
    return true;
  } catch (err) {
    toast(`Löschen fehlgeschlagen: ${err.message}`, true);
    return false;
  }
}

// ---------- Statistik ----------
// Ø pro Tag = Summe aller Ausgaben ÷ Tage seit der ersten Ausgabe (inkl. heute).
// Ø pro Woche = Ø Tag × 7, Ø pro Monat = Ø Tag × 30,44.

function renderStats() {
  const body = $("#stats-body");
  const list = state.entries;
  if (!list.length) {
    body.innerHTML = `<p class="empty">Noch keine Ausgaben. Trag deine erste ein, dann erscheint hier die Statistik.</p>`;
    return;
  }
  const today = isoDate();
  const first = list.reduce((min, e) => (e.datum < min ? e.datum : min), today);
  const days = Math.max(1, daysBetween(first, today) + 1);
  const total = sum(list.filter((e) => e.datum <= today));
  const perDay = total / days;
  const week = weekEntries();
  const monthPrefix = today.slice(0, 7);
  const month = list.filter((e) => e.datum.startsWith(monthPrefix));

  const byCat = new Map();
  for (const e of month) byCat.set(e.kategorie || "Ohne Kategorie", (byCat.get(e.kategorie || "Ohne Kategorie") || 0) + Number(e.betrag));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? cats[0][1] : 1;

  const monthName = new Date().toLocaleDateString("de-DE", { month: "long" });
  body.innerHTML = `
    <div class="stat-hero">
      <p class="small-txt">Summe diese Woche</p>
      <p class="big">${euro.format(sum(week))}</p>
      <p class="small-txt">${week.length} ${week.length === 1 ? "Ausgabe" : "Ausgaben"} seit Montag</p>
    </div>
    <div class="stat-grid">
      <div class="stat"><p class="k">Ø Tag</p><p class="v">${euro.format(perDay)}</p></div>
      <div class="stat"><p class="k">Ø Woche</p><p class="v">${euro.format(perDay * 7)}</p></div>
      <div class="stat"><p class="k">Ø Monat</p><p class="v">${euro.format(perDay * 30.44)}</p></div>
    </div>
    <p class="hint">Durchschnitt über ${days} ${days === 1 ? "Tag" : "Tage"} seit deiner ersten Ausgabe (${euro.format(total)} insgesamt).</p>
    <h2 class="section-title">${monthName}: ${euro.format(sum(month))}</h2>
    ${cats.length ? `<ul class="bars">${cats.map(([name, val]) => `
      <li>
        <div class="bar-head"><span>${escapeHtml(name)}</span><b>${euro.format(val)}</b></div>
        <div class="bar"><i style="width:${Math.max(3, (val / maxCat) * 100)}%"></i></div>
      </li>`).join("")}</ul>` : `<p class="hint">In diesem Monat noch nichts ausgegeben.</p>`}
  `;
}

// ---------- Verlauf ----------

const TRASH = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`;

function renderHistory() {
  const body = $("#history-body");
  if (!state.entries.length) {
    body.innerHTML = `<p class="empty">Noch keine Einträge.</p>`;
    return;
  }
  const groups = new Map();
  for (const e of state.entries) {
    if (!groups.has(e.datum)) groups.set(e.datum, []);
    groups.get(e.datum).push(e);
  }
  body.replaceChildren(...[...groups.entries()].map(([datum, items]) => {
    const day = document.createElement("div");
    day.className = "day";
    day.innerHTML = `<div class="day-head"><span>${formatDay(datum)}</span><span>${euro.format(sum(items))}</span></div>`;
    const ul = document.createElement("ul");
    ul.className = "day-list";
    for (const e of items) {
      const li = document.createElement("li");
      li.className = "row";
      li.innerHTML = `
        <button type="button" class="row-main" aria-label="Bearbeiten">
          <span class="row-text">
            <span class="row-cat">${escapeHtml(e.kategorie || "Ohne Kategorie")}</span>
            ${e.notiz ? `<span class="row-note">${escapeHtml(e.notiz)}</span>` : ""}
          </span>
          <span class="row-amt">${euro.format(e.betrag)}</span>
        </button>
        <button type="button" class="row-del" aria-label="Löschen">${TRASH}</button>`;
      li.querySelector(".row-main").addEventListener("click", () => openEntry(e));
      li.querySelector(".row-del").addEventListener("click", async () => {
        if (await deleteEntry(e)) renderHistory();
      });
      ul.append(li);
    }
    day.append(ul);
    return day;
  }));
}

// ---------- Einstellungen ----------

const ICON_UP = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`;

function renderSettings() {
  const ul = $("#cat-list");
  ul.replaceChildren(...state.cats.map((c, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <input aria-label="Kategorie umbenennen" maxlength="40">
      <button type="button" data-act="up" aria-label="Nach oben" ${i === 0 ? "disabled" : ""}>${ICON_UP}</button>
      <button type="button" data-act="del" aria-label="Löschen">${TRASH}</button>`;
    const input = li.querySelector("input");
    input.value = c;
    input.addEventListener("change", () => {
      const name = input.value.trim();
      if (!name || state.cats.some((x, j) => j !== i && x === name)) { input.value = c; return; }
      state.cats[i] = name;
      saveCats();
      toast("Umbenannt");
    });
    li.querySelector('[data-act="up"]').addEventListener("click", () => {
      [state.cats[i - 1], state.cats[i]] = [state.cats[i], state.cats[i - 1]];
      saveCats();
      renderSettings();
    });
    li.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (state.cats.length === 1) { toast("Mindestens eine Kategorie muss bleiben", true); return; }
      if (!confirm(`Kategorie „${c}“ entfernen?`)) return;
      state.cats.splice(i, 1);
      saveCats();
      renderSettings();
    });
    return li;
  }));
  $("#conn-info").textContent = configured
    ? `Verbunden mit ${new URL(cfg.SUPABASE_URL).host}. ${state.entries.length} Einträge gespeichert.`
    : "Demo-Modus: In config.js fehlen SUPABASE_URL und der Publishable Key.";
}

function addCat(ev) {
  ev.preventDefault();
  const input = $("#cat-new");
  const name = input.value.trim();
  if (!name) return;
  if (state.cats.includes(name)) { toast("Gibt es schon", true); return; }
  state.cats.push(name);
  saveCats();
  input.value = "";
  renderSettings();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Start der App ----------

async function init() {
  $("#btn-add").addEventListener("click", () => openEntry());
  $("#btn-scan").addEventListener("click", () => $("#scan-input").click());
  $("#scan-input").addEventListener("change", (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (file) openEntry(null, { photoFile: file });
  });
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", back));
  $("#entry-form").addEventListener("submit", saveEntry);
  $("#f-betrag").addEventListener("input", () => { $("#f-error").hidden = true; });
  $("#f-delete").addEventListener("click", async () => {
    if (state.editing && (await deleteEntry(state.editing))) back();
  });
  $("#cat-add-form").addEventListener("submit", addCat);

  $("#demo-banner").hidden = configured;
  try {
    state.db = configured ? await createSupabaseDb() : createDemoDb();
  } catch (err) {
    toast(`Supabase konnte nicht geladen werden: ${err.message}`, true);
    return;
  }
  await reload();
  renderHome();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* ohne Offline-Cache weiter */ });
  }
}

init();
