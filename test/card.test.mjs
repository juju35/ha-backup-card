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

test("classic header (illustration: false): the worst status in the chip, the counts in the subtitle", async () => {
  const { html } = await mount({ illustration: false });
  assert.match(html(), /1 failed · 1 late/);
  assert.match(html(), /class="chip crit[^"]*"[^>]*title="Failed"/);
  assert.doesNotMatch(html(), /class="banner/);
  const ok = await mount({ illustration: false }, "ok");
  assert.match(ok.html(), /All up to date/);
  assert.match(ok.html(), /chip ok/);
});

test("illustrated header: the scene, the icon's color and the subtitle follow the worst status", async () => {
  const { html } = await mount();
  assert.match(html(), /class="banner bk-failed/);
  assert.match(html(), /class="type-icon crit[^"]*"[^>]*title="Failed"/);
  assert.match(html(), /1 failed · 1 late/);
  assert.match(html(), /class="bk-ground"/);
  const ok = await mount({}, "ok");
  assert.match(ok.html(), /class="banner bk-ok/);
  assert.match(ok.html(), /class="type-icon ok/);
  assert.match(ok.html(), /class="bk-mark ok"/);
  const run = await mount({}, "running");
  assert.match(run.html(), /class="banner bk-running/);
  assert.match(run.html(), /class="type-icon active/);
  assert.equal((run.html().match(/class="bk-pk"/g) || []).length, 3);
});

test("illustrated header: night by illustration_theme, sun.sun or the dark theme, and ids per card", async () => {
  assert.match((await mount({ illustration_theme: "night" })).html(), /class="banner bk-failed night"/);
  assert.doesNotMatch((await mount({ illustration_theme: "day" })).html(), /night"/);
  const sky = async (sun, dark, config = {}) => {
    const { card, hass, html } = await mount(config);
    card.hass = { ...hass, states: { ...hass.states, "sun.sun": { entity_id: "sun.sun", state: sun } }, themes: { darkMode: dark } };
    await new Promise((r) => setTimeout(r, 0));
    return /class="banner [^"]*\bnight"/.test(html());
  };
  assert.equal(await sky("above_horizon", true), true, "dark theme while the sun is up: night");
  assert.equal(await sky("above_horizon", false), false, "light theme while the sun is up: day");
  assert.equal(await sky("below_horizon", false), true);
  assert.equal(await sky("unavailable", true), true);
  assert.equal(await sky("above_horizon", true, { illustration_theme: "day" }), false);
  assert.equal(await sky("above_horizon", false, { illustration_theme: "night" }), true);
  const a = await mount();
  const b = await mount();
  const id = (h) => h.match(/id="(bk-win-\d+)"/)[1];
  assert.notEqual(id(a.html()), id(b.html()));
  assert.match(a.html(), new RegExp(`url\\(#${id(a.html())}\\)`));
});

test("rows: the last backup, the size and the next one, and the age", async () => {
  const { html } = await mount();
  assert.match(html(), /Last today 4:52 AM/);
  assert.match(html(), /1.4 GB · Next tomorrow 4:45 AM/);
  assert.match(html(), /Failed today 2:00 AM/);
  assert.match(html(), /Older than 26h/);
  assert.match(html(), /Proxmox VE/);
});

test("summary: time since the newest good backup, the failed and late ones, the next one and the total size", async () => {
  const { html } = await mount();
  assert.match(html(), /class="hero"/);
  assert.match(html(), /<b>3h<\/b><span>since the last good backup<\/span>/);
  assert.match(html(), /class="line crit">.*?<span>Documents failed today 2:00 AM<\/span>/s);
  assert.match(html(), /class="line warn">.*?<span>Node pve older than 26h<\/span>/s);
  assert.match(html(), /<span>Next tomorrow 4:45 AM · 25 GB<\/span>/);
  const off = await mount({ show_stats: false, show_size: false, show_next: false });
  assert.doesNotMatch(off.html(), /class="hero"|GB|Next tomorrow/);
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
  assert.match(html(), /class="hero"/);
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

// A hass of its own for the integration cases below: entities given as [entity_id, state, attributes, registry].
const hassOf = (rows, devices = {}) => {
  const states = {};
  const entities = {};
  for (const [entity_id, state, attributes = {}, reg] of rows) {
    states[entity_id] = { entity_id, state: String(state), attributes, last_changed: new Date(NOW - H).toISOString(), last_updated: new Date(NOW - H).toISOString() };
    if (reg) entities[entity_id] = { entity_id, device_id: null, translation_key: null, ...reg };
  }
  return { states, entities, devices, areas: {}, language: "en", locale: { language: "en" }, callService() {} };
};
const iso = (ms) => new Date(ms).toISOString();

test("Proxmox VE: only the node's backup entities count, never its status, health, guests or power buttons", () => {
  const core = { platform: "proxmoxve", device_id: "node" };
  const vm = { platform: "proxmoxve", device_id: "vm" };
  const custom = { platform: "proxmoxve", device_id: "node2" };
  const hass = hassOf(
    [
      // Core: a node up (status running), unhealthy (problem), with a good last backup.
      ["binary_sensor.pve_status", "on", { device_class: "running", friendly_name: "pve Status" }, { ...core, translation_key: "status" }],
      ["binary_sensor.pve_health", "on", { device_class: "problem", friendly_name: "pve Health" }, { ...core, translation_key: "health" }],
      ["binary_sensor.pve_backup_status", "off", { device_class: "problem", friendly_name: "pve Backup status" }, { ...core, translation_key: "node_backup_status" }],
      ["sensor.pve_last_backup", iso(NOW - 5 * H), { device_class: "timestamp", friendly_name: "pve Last backup" }, { ...core, translation_key: "node_backup_last_backup" }],
      ["sensor.pve_backup_duration", "600", { device_class: "duration", unit_of_measurement: "s" }, { ...core, translation_key: "node_backup_duration" }],
      ["button.pve_reboot", "unknown", { friendly_name: "pve Reboot" }, { ...core, translation_key: "reboot" }],
      ["button.pve_start_all", "unknown", { friendly_name: "pve Start all" }, { ...core, translation_key: "start_all" }],
      // A guest: running, with a status sensor, but no backup entity.
      ["binary_sensor.vm_status", "on", { device_class: "running", friendly_name: "web Status" }, { ...vm, translation_key: "status" }],
      ["sensor.vm_status", "running", { friendly_name: "web Status" }, { ...vm, translation_key: "vm_status" }],
      ["button.vm_start", "unknown", { friendly_name: "web Start" }, { ...vm, translation_key: "start" }],
      // Custom integration: backup running / status / last, and a back-up button next to a start button.
      ["binary_sensor.pbs_status", "on", { device_class: "running", friendly_name: "node2 Status" }, { ...custom, translation_key: "status" }],
      ["binary_sensor.pbs_backup_running", "off", { device_class: "running", friendly_name: "node2 Backup running" }, { ...custom, translation_key: "backup_running" }],
      ["binary_sensor.pbs_backup_status", "off", { device_class: "problem", friendly_name: "node2 Backup status" }, { ...custom, translation_key: "backup_status" }],
      ["sensor.pbs_backup_last", iso(NOW - 2 * H), { device_class: "timestamp", friendly_name: "node2 Last backup" }, { ...custom, translation_key: "backup_last" }],
      ["button.pbs_start", "unknown", { friendly_name: "node2 Start" }, { ...custom, translation_key: "start" }],
      ["button.pbs_backup_all", "unknown", { friendly_name: "node2 Back up all" }, { ...custom, translation_key: "backup_all" }],
    ],
    { node: { id: "node", name: "Node pve" }, vm: { id: "vm", name: "web" }, node2: { id: "node2", name: "Node pve2" } },
  );
  const m = bk.resolve(hass, {});
  same(
    m.map((x) => x.name),
    ["Node pve", "Node pve2"],
  );
  const [a, b] = m.map((src) => bk.sourceState(hass, src, { now: NOW }));
  assert.equal(a.status, "ok");
  assert.equal(a.running, false);
  assert.equal(a.failed, false);
  assert.equal(m[0].parts.last, "sensor.pve_last_backup");
  assert.equal(m[0].button, null);
  assert.equal(b.status, "ok");
  assert.equal(m[1].parts.last, "sensor.pbs_backup_last");
  assert.equal(m[1].parts.running, "binary_sensor.pbs_backup_running");
  assert.equal(m[1].button, "button.pbs_backup_all");
  // The backup itself failing is a failure.
  hass.states["binary_sensor.pve_backup_status"].state = "on";
  assert.equal(bk.sourceState(hass, bk.resolve(hass, {})[0], { now: NOW }).status, "failed");
});

test("Proxmox VE: a node or a guest named after backups is still not a backup", () => {
  const node = { platform: "proxmoxve", device_id: "node" };
  const vm = { platform: "proxmoxve", device_id: "vm" };
  const hass = hassOf(
    [
      // A node named "pve-backup": up (status running), with power buttons, and its real backup sensors.
      ["binary_sensor.pve_backup_status", "on", { device_class: "running", friendly_name: "pve-backup Status" }, { ...node, translation_key: "status" }],
      ["binary_sensor.pve_backup_health", "on", { device_class: "problem", friendly_name: "pve-backup Health" }, { ...node, translation_key: "health" }],
      ["button.pve_backup_shutdown", "unknown", { friendly_name: "pve-backup Shutdown" }, { ...node, translation_key: "shutdown" }],
      ["button.pve_backup_start_all", "unknown", { friendly_name: "pve-backup Start all" }, { ...node, translation_key: "start_all" }],
      ["sensor.pve_backup_last_backup", iso(NOW - 5 * H), { device_class: "timestamp", friendly_name: "pve-backup Last backup" }, { ...node, translation_key: "node_backup_last_backup" }],
      // A guest named "backup" (Proxmox Backup Server in a VM), with no backup entity of its own.
      ["sensor.backup_status", "running", { friendly_name: "backup Status" }, { ...vm, translation_key: "vm_status" }],
      ["binary_sensor.backup_status", "on", { device_class: "running", friendly_name: "backup Status" }, { ...vm, translation_key: "status" }],
      ["button.backup_start", "unknown", { friendly_name: "backup Start" }, { ...vm, translation_key: "start" }],
      ["button.backup_shutdown", "unknown", { friendly_name: "backup Shutdown" }, { ...vm, translation_key: "shutdown" }],
    ],
    { node: { id: "node", name: "pve-backup" }, vm: { id: "vm", name: "backup" } },
  );
  check(hass);
  // Renamed in Home Assistant: the entity ids keep the original names.
  hass.devices.node.name_by_user = "Main server";
  hass.devices.vm.name_by_user = "Archive";
  // Their friendly names follow the new device names, as in Home Assistant.
  for (const st of Object.values(hass.states)) {
    const f = st.attributes.friendly_name;
    st.attributes = { ...st.attributes, friendly_name: f.replace(/^pve-backup /, "Main server ").replace(/^backup /, "Archive ") };
  }
  check({ ...hass, entities: { ...hass.entities } });
});

function check(hass) {
  const m = bk.resolve(hass, {});
  same(
    m.map((x) => x.name),
    [hass.devices.node.name_by_user || "pve-backup"],
  );
  const st = bk.sourceState(hass, m[0], { now: NOW });
  assert.equal(st.status, "ok");
  assert.equal(st.running, false);
  assert.equal(st.failed, false);
  assert.equal(m[0].parts.running ?? null, null);
  assert.equal(m[0].parts.failed ?? null, null);
  assert.equal(m[0].button, null);
}

test("Auto Backup next to Home Assistant's backups: Home Assistant's backups are listed once", () => {
  const ha = { platform: "backup", device_id: null };
  const ab = { platform: "auto_backup", device_id: null };
  const rows = [
    ["sensor.backup_last", iso(NOW - 5 * H), { device_class: "timestamp" }, { ...ha, translation_key: "last_successful_automatic_backup" }],
    ["sensor.auto_backup_last_success", iso(NOW - 3 * H), { device_class: "timestamp" }, { ...ab, translation_key: "last_success" }],
  ];
  same(
    bk.resolve(hassOf(rows), {}).map((x) => x.platform),
    ["backup"],
  );
  same(
    bk.resolve(hassOf([rows[1]]), {}).map((x) => x.platform),
    ["auto_backup"],
  );  // Home Assistant's backups set up but unused (no backup yet): Auto Backup, which makes them, is kept.
  const unused = [["sensor.backup_last", "unknown", { device_class: "timestamp" }, { ...ha, translation_key: "last_successful_automatic_backup" }], rows[1]];
  same(
    bk.resolve(hassOf(unused), {}).map((x) => x.platform),
    ["backup", "auto_backup"],
  );
});

test("Samba Backup and OneDrive Backup add-ons: found by their sensors, states read", () => {
  const samba = (state) => ["sensor.samba_backup", state, { friendly_name: "Samba Backup", backups_local: "3", backups_remote: "5", total_backups_succeeded: "12", total_backups_failed: "1", last_backup: "2026-11-16 04:00" }];
  const one = (state, last) => ["sensor.onedrivebackup", state, { "Last Local backup date": last, "Last OneDrive backup date": last, "Backups in Home Assistant": "2", "Backups in OneDrive": "4" }];
  const hass = hassOf([samba("IDLE"), one("Backed_Up", "2026-11-16 03:00:00")]);
  const m = bk.resolve(hass, {});
  same(
    m.map((x) => [x.platform, x.name]),
    [
      ["samba_backup", "Samba Backup"],
      ["onedrive_backup", "OneDrive Backup"],
    ],
  );
  const st = (h) => bk.resolve(h, {}).map((src) => bk.sourceState(h, src, { now: NOW }));
  const [s, o] = st(hass);
  assert.equal(s.status, "ok");
  assert.equal(s.last, Date.parse("2026-11-16T04:00"));
  assert.equal(o.status, "ok");
  assert.equal(o.last, Date.parse("2026-11-16T03:00:00"));
  same(
    st(hassOf([samba("RUNNING"), one("Syncing", "2026-11-16 03:00:00")])).map((x) => x.status),
    ["running", "running"],
  );
  same(
    st(hassOf([samba("FAILED"), one("Stale", "2026-11-16 03:00:00")])).map((x) => x.status),
    ["failed", "late"],
  );
  // Samba Backup started through the add-on's input, when its slug is given.
  const [src] = bk.resolve(hass, { backups: [{ entity: "sensor.samba_backup", addon: "15d21743_samba_backup" }] });
  same(src.run, ["hassio", "addon_stdin", { addon: "15d21743_samba_backup", input: "trigger" }]);
  assert.equal(bk.resolve(hass, { backups: ["sensor.samba_backup"] })[0].run, null);
});

test("the hero's shield is green only when every backup is up to date; an unavailable button is disabled", async () => {
  const { html } = await mount();
  assert.match(html(), /class="big idle">/);
  const hass = makeHass();
  hass.states["button.photos_lancer"] = { ...hass.states["button.photos_lancer"], state: "unavailable" };
  const card = new BackupCard();
  card.setConfig({});
  card.hass = hass;
  const btn = /<button[^>]*data-action="run"[^>]*aria-label="[^"]*Photos"[^>]*>/.exec(card.shadowRoot.innerHTML)?.[0] || "";
  assert.match(btn, / disabled/);
});

test("Auto Backup is dropped once Home Assistant's own backups have a last backup, without a reload", () => {
  const ha = { platform: "backup", device_id: null };
  const ab = { platform: "auto_backup", device_id: null };
  const hass = hassOf([
    ["sensor.backup_last", "unknown", { device_class: "timestamp" }, { ...ha, translation_key: "last_successful_automatic_backup" }],
    ["sensor.auto_backup_last_success", iso(NOW - 3 * H), { device_class: "timestamp" }, { ...ab, translation_key: "last_success" }],
  ]);
  assert.equal(bk.resolve(hass, {}).length, 2);
  hass.states["sensor.backup_last"] = { ...hass.states["sensor.backup_last"], state: iso(NOW - H) };
  same(
    bk.resolve(hass, {}).map((x) => x.platform),
    ["backup"],
  );
});
