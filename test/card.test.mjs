import assert from "node:assert/strict";
import { test } from "node:test";
import { mockData, NOW } from "../scripts/mock-states.mjs";
import { load } from "./load.mjs";

const bk = load({ names: ["toBytes", "fmtSize", "resolve", "sourceState", "STRINGS", "LANGUAGES"] });
const BackupCard = bk.element("backup-card");
const BackupMiniCard = bk.element("backup-mini-card");
// Objects from the sandbox have the sandbox's prototypes: compared as plain JSON.
const same = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg);
const H = 3.6e6;

const makeHass = (variant = "default", { language = "en" } = {}) => {
  const d = mockData(variant);
  const calls = [];
  return { calls, ...d, language, locale: { language }, callService: (...a) => calls.push(a) };
};

const mount = async (config = {}, variant = "default", Card = BackupCard, opts = {}) => {
  const card = new Card();
  card._connected = true;
  card.setConfig(config);
  const hass = makeHass(variant, opts);
  card.hass = hass;
  card.connectedCallback();
  await new Promise((r) => setTimeout(r, 0));
  // Intl puts narrow no-break spaces in times ("4:52 AM"): plain spaces for the assertions.
  return { card, hass, html: () => card.shadowRoot.innerHTML.replace(/[   ]/g, " ") };
};

const click = (card, dataset) => card._onClick({ composedPath: () => [{ dataset }], stopPropagation() {}, detail: 1 });
const states = (hass) => {
  const m = bk.resolve(hass, {});
  return Object.fromEntries(m.map((src) => [src.name, bk.sourceState(hass, src, { now: NOW })]));
};

test("sizes: value and unit to bytes, and back in the largest unit", () => {
  assert.equal(bk.toBytes("1432.6", "MB"), 1432.6e6);
  assert.equal(bk.toBytes("5.4 GB"), 5.4e9);
  assert.equal(bk.toBytes("2", "GiB"), 2 * 1024 ** 3);
  assert.equal(bk.toBytes("12,5", "kB"), 12500);
  assert.equal(bk.toBytes("n/a"), null);
  assert.equal(bk.fmtSize(1432.6e6, "en").replace(/\s/g, " "), "1.4 GB");
  assert.equal(bk.fmtSize(820e6, "en").replace(/\s/g, " "), "820 MB");
});

test("every source is discovered from the registries, whatever the entity ids", () => {
  const m = bk.resolve(makeHass(), {});
  same(
    m.map((x) => [x.platform, x.name, x.sub]),
    [
      ["backup", "Home Assistant", ""],
      ["google_drive_backup", "Google Drive Backup", ""],
      ["proxmoxve", "Node pve", "Proxmox VE"],
      ["duplicati_monitor", "Documents", "Duplicati"],
      ["backrest", "Photos", "Backrest"],
    ],
  );
  const ha = m[0].parts;
  assert.equal(ha.last, "sensor.sauvegarde_derniere");
  assert.equal(ha.attempt, "sensor.sauvegarde_tentative");
  assert.equal(ha.next, "sensor.sauvegarde_prochaine");
  assert.equal(ha.size, "sensor.sauvegarde_taille");
  assert.equal(ha.status, "sensor.sauvegarde_etat");
  // Duplicati Monitor: the job's size, not the total nor the free space.
  assert.equal(m[3].parts.size, "sensor.documents_taille");
  const br = m[4].parts;
  same([br.last, br.running, br.failed, br.button], ["sensor.photos_derniere", "binary_sensor.photos_en_cours", "binary_sensor.photos_echec", "button.photos_lancer"]);
});

test("states: up to date, late against the limit, failed after the last good one", () => {
  const s = states(makeHass());
  same(
    Object.values(s).map((x) => x.status),
    ["ok", "ok", "late", "failed", "ok"],
  );
  assert.equal(s["Home Assistant"].last, Date.parse("2026-11-16T04:52:00Z"));
  assert.equal(s["Home Assistant"].size, 1432.6e6);
  assert.equal(s["Google Drive Backup"].size, 5.4e9);
  assert.equal(s.Documents.failedAt, Date.parse("2026-11-16T02:00:00Z"));
  assert.equal(s["Node pve"].age, 7 * 24 * H + 2 * H);
});

test("an attempt after the last good backup, or a failed binary sensor, is a failure", () => {
  const hass = makeHass();
  hass.states["sensor.sauvegarde_tentative"].state = new Date(NOW - H).toISOString();
  hass.states["binary_sensor.photos_echec"].state = "on";
  const s = states(hass);
  assert.equal(s["Home Assistant"].status, "failed");
  assert.equal(s["Home Assistant"].failedAt, NOW - H);
  assert.equal(s.Photos.status, "failed");
});

test("a scheduled backup missed by more than an hour is late, whatever the limit", () => {
  const hass = makeHass();
  hass.states["sensor.sauvegarde_prochaine"].state = new Date(NOW - 2 * H).toISOString();
  assert.equal(states(hass)["Home Assistant"].status, "late");
});

test("running: Home Assistant creating a backup, Backrest's running sensor", () => {
  const s = states(makeHass("running"));
  assert.equal(s["Home Assistant"].status, "running");
  assert.equal(s.Photos.status, "running");
});

test("the limit: max_age of the card, or of one backup", async () => {
  const { card } = await mount({ max_age: 24 * 8 });
  assert.equal(card._summary(card._resolve()).items.find((x) => x.src.name === "Node pve").status, "ok");
  const m = bk.resolve(makeHass(), { backups: [{ entity: "sensor.pve_derniere_sauvegarde", max_age: 200 }] });
  assert.equal(bk.sourceState(makeHass(), m[0], { now: NOW }).status, "ok");
});

test("header: the worst status in the chip, the counts in the subtitle", async () => {
  const { html } = await mount();
  assert.match(html(), /1 failed · 1 late/);
  assert.match(html(), /class="chip crit[^"]*"[^>]*title="Failed"/);
  const ok = await mount({}, "ok");
  assert.match(ok.html(), /All up to date/);
  assert.match(ok.html(), /chip ok/);
});

test("rows: the last backup, the size and the next one, and the age", async () => {
  const { html } = await mount();
  assert.match(html(), /Last today 4:52 AM/);
  assert.match(html(), /1.4 GB · Next tomorrow 4:45 AM/);
  assert.match(html(), /Failed today 2:00 AM/);
  assert.match(html(), /Older than 26h/);
  assert.match(html(), /Proxmox VE/);
});

test("summary: the newest backup, the next one and the total size", async () => {
  const { html } = await mount();
  assert.match(html(), /Last backup<\/div><div class="v num">3 hr\. ago/);
  assert.match(html(), /Next backup<\/div><div class="v num">in 19 hr\./);
  assert.match(html(), /Total size<\/div><div class="v num">25 GB/);
  const off = await mount({ show_stats: false, show_size: false, show_next: false });
  assert.doesNotMatch(off.html(), /class="stats"|GB|Next tomorrow/);
});

test("back up now: Home Assistant's service, Backrest's button; then shown running", async () => {
  const { card, hass, html } = await mount();
  const m = card._resolve();
  click(card, { action: "run", key: m[0].key });
  same(hass.calls[0], ["backup", "create_automatic", {}]);
  click(card, { action: "run", key: m[4].key });
  same(hass.calls[1], ["button", "press", { entity_id: "button.photos_lancer" }]);
  assert.equal((html().match(/class="spin"/g) || []).length, 2);
  assert.match(html(), /2 running/);
  clearTimeout(card._runTimer);
});

test("no way to start one: no button (Proxmox, the add-on); show_run hides them all", async () => {
  const { html } = await mount();
  assert.equal((html().match(/data-action="run"/g) || []).length, 2);
  const off = await mount({ show_run: false });
  assert.doesNotMatch(off.html(), /data-action="run"/);
});

test("configured backups: their last backup sensor, the add-on's sensor, names and buttons", () => {
  const hass = makeHass();
  const m = bk.resolve(hass, {
    backups: ["sensor.backup_state", { entity: "sensor.documents_derniere", name: "Docs" }, "sensor.unknown"],
  });
  same(
    m.map((x) => [x.platform, x.name]),
    [
      ["google_drive_backup", "Google Drive Backup"],
      ["duplicati_monitor", "Docs"],
    ],
  );
  assert.equal(m[1].parts.status, "sensor.documents_statut");
});

test("any other integration: a timestamp sensor of a last backup is found with its device", () => {
  const hass = makeHass();
  hass.devices.nas = { id: "nas", name: "NAS", name_by_user: null };
  hass.entities["sensor.nas_derniere"] = { entity_id: "sensor.nas_derniere", device_id: "nas", platform: "synology_dsm", translation_key: null };
  hass.states["sensor.nas_derniere"] = { entity_id: "sensor.nas_derniere", state: new Date(NOW - 2 * H).toISOString(), attributes: { friendly_name: "NAS Last backup", device_class: "timestamp" } };
  hass.entities = { ...hass.entities };
  const m = bk.resolve(hass, {});
  const nas = m.find((x) => x.name === "NAS");
  assert.ok(nas);
  assert.equal(nas.parts.last, "sensor.nas_derniere");
  assert.equal(bk.sourceState(hass, nas, { now: NOW }).status, "ok");
});

test("Duplicati: its running and problem sensors by device class, the target size, the create backup button", () => {
  const hass = makeHass();
  hass.devices.dup = { id: "dup", name: "Music", name_by_user: null };
  const add = (entity_id, state, attributes, translation_key) => {
    hass.entities[entity_id] = { entity_id, device_id: "dup", platform: "duplicati", translation_key };
    hass.states[entity_id] = { entity_id, state, attributes };
  };
  add("sensor.music_execution", new Date(NOW - 5 * H).toISOString(), { friendly_name: "Music Last backup execution", device_class: "timestamp" }, "last_backup_execution");
  add("sensor.music_source", "40", { friendly_name: "Music Last backup source size", unit_of_measurement: "GB" }, "last_backup_source_size");
  add("sensor.music_target", "31", { friendly_name: "Music Last backup target size", unit_of_measurement: "GB" }, "last_backup_target_size");
  add("binary_sensor.music_status", "on", { friendly_name: "Music Last backup status", device_class: "problem" }, "last_backup_status");
  add("binary_sensor.music_current", "off", { friendly_name: "Music Current status", device_class: "running" }, "current_status");
  add("button.music_refresh", "unknown", { friendly_name: "Music Refresh sensor data" }, "refresh_sensor_data");
  add("button.music_create", "unknown", { friendly_name: "Music Create backup" }, "create_backup");
  hass.entities = { ...hass.entities };
  const src = bk.resolve(hass, {}).find((x) => x.platform === "duplicati");
  same([src.parts.last, src.parts.size, src.parts.failed, src.parts.running, src.button], ["sensor.music_execution", "sensor.music_target", "binary_sensor.music_status", "binary_sensor.music_current", "button.music_create"]);
  assert.equal(bk.sourceState(hass, src, { now: NOW }).status, "failed");
});

test("Backrest: the trigger button, not the prune one", () => {
  const src = bk.resolve(makeHass(), {}).find((x) => x.platform === "backrest");
  assert.equal(src.button, "button.photos_lancer");
});

test("mini card: the worst first with their age, a back up now button; the detail button shows the full card", async () => {
  const { card, html } = await mount({}, "default", BackupMiniCard);
  assert.match(html(), /content mini/);
  const names = [...html().matchAll(/<span>([^<]+)<\/span><span class="num">([^<]+)</g)].map((x) => [x[1], x[2]]);
  same(names, [
    ["Documents", "32h"],
    ["Node pve", "7d"],
    ["Home Assistant", "5h"],
  ]);
  assert.match(html(), /data-action="run"/);
  click(card, { action: "zoom" });
  assert.match(html(), /class="stats"/);
  card._unzoom.tap({ composedPath: () => [] });
  assert.match(html(), /content mini/);
});

test("folding: the backups section folds and unfolds", async () => {
  const { card, html } = await mount({ collapsed: ["backups"] });
  assert.doesNotMatch(html(), /class="row"/);
  click(card, { action: "toggle_section", section: "backups" });
  assert.match(html(), /class="row"/);
});

test("nothing found: a clear message instead of an empty card", () => {
  const card = new BackupCard();
  card.setConfig({});
  card.hass = { states: {}, entities: {}, devices: {}, language: "en" };
  assert.match(card.shadowRoot.innerHTML, /no backup found/);
});

test("French: texts, times and sizes in the card's language", async () => {
  const { html } = await mount({ language: "fr" });
  assert.match(html(), /1 en échec · 1 en retard/);
  assert.match(html(), /Dernière aujourd&#39;hui 4:52/);
  assert.match(html(), /1,4 Go/);
});

test("every language has every text, with the same placeholders as English", () => {
  const en = bk.STRINGS.en;
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [l, table] of Object.entries(bk.STRINGS)) {
    assert.deepEqual(Object.keys(table).sort(), Object.keys(en).sort(), l);
    for (const k of Object.keys(en)) assert.deepEqual(ph(table[k]), ph(en[k]), `${l}.${k}`);
  }
  assert.equal(bk.LANGUAGES.length, Object.keys(bk.STRINGS).length);
});

test("visual editor: fields labelled apart from the sections, defaults left out of the YAML; the mini editor adds the detail button", () => {
  const Editor = bk.element("backup-card-editor");
  const MiniEditor = bk.element("backup-mini-card-editor");
  const doc = bk.window.document;
  const create = doc.createElement;
  let form;
  doc.createElement = (tag) => (form = { tag, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
  try {
    const ed = new Editor();
    let out;
    ed.dispatchEvent = (ev) => {
      out = ev.detail.config;
    };
    ed.setConfig({ type: "custom:backup-card" });
    ed.hass = makeHass();
    assert.match(form.computeLabel({ name: "backups" }), /empty: automatic/);
    assert.match(form.computeHelper({ name: "max_age" }), /In hours/);
    form.listeners["value-changed"]({ stopPropagation() {}, detail: { value: { type: "custom:backup-card", show_run: true, show_size: false, backups: [] } } });
    same(out, { type: "custom:backup-card", show_size: false });
  } finally {
    doc.createElement = create;
  }
  assert.ok(MiniEditor.toggles.some(([n]) => n === "zoom"));
});

test("every clickable element can be reached and used from the keyboard", async () => {
  const { html } = await mount();
  for (const m of html().matchAll(/<(div|span)[^>]*data-(entity|action)=[^>]*>/g)) {
    assert.match(m[0], /role="button"/, m[0]);
    assert.match(m[0], /tabindex="0"/, m[0]);
  }
});
