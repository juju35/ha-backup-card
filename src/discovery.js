// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
import { MAX_AGE_H, PLATFORMS, PROXMOX, RUN_MS } from "./core.js";
import { asList, byDevice, devName, deviceClass, domainOf, keyText, nameOf, parseTime, shortName, valid } from "./helpers.js";

// A size in bytes from a value and its unit (B to TB, KiB to TiB; a sensor of Home Assistant's backups is in MB).
export const UNIT_BYTES = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };
export const toBytes = (v, unit) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const m = /([kmgt]?i?b)\b/i.exec(unit || String(v));
  return n * (UNIT_BYTES[(m?.[1] || "b").toLowerCase()] ?? 1);
};

// The parts of a backup source among a list of registry entries: the time of the last good backup, of the last
// attempt and of the last failure, a status text, the next scheduled backup, the size, a "running" and a "failed"
// binary sensor, and the button that starts a backup.
// Buttons of other tasks than a backup (Backrest's prune, check, forget…).
export const OTHER_TASK = /prune|check|forget|refresh|unlock|stats|purge|restore|cancel/;
export const NOT_LAST = /attempt|fail|size|duration|result|status|next|count|number|free|speed/;
export const slug = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
// What an entity is called without its device's name: its object id less the device's slug in front, its translation
// key and its short name. A node or a guest named "pve-backup" is not a backup entity.
export const ownText = (e, hass) => {
  const d = hass.devices?.[e.device_id];
  // The entity id keeps the device's original name, even after a rename: both names are stripped.
  const devs = [d?.name_by_user, d?.name].map((n) => slug(n || "")).filter(Boolean);
  let obj = e.entity_id.split(".")[1] || "";
  for (const dev of devs) if (obj.startsWith(`${dev}_`)) obj = obj.slice(dev.length + 1);
  const name = slug(shortName(hass, e.entity_id));
  return [obj, e.translation_key, devs.includes(name) ? "" : name].filter(Boolean).join(" ");
};
// `strict` (Proxmox VE): only the entities about backups count, never the node's or a guest's status, health or
// power buttons, whatever the device is called.
export const findParts = (hass, list, strict = false) => {
  const kt = strict ? (e) => ownText(e, hass) : (e) => keyText(e, hass);
  if (strict) list = list.filter((e) => /backup/.test(kt(e)));
  const time = (e) => deviceClass(hass, e.entity_id) === "timestamp" || parseTime(hass.states[e.entity_id]?.state) !== null;
  const pk = (domain, re, test = () => true) => list.find((e) => domainOf(e.entity_id) === domain && re.test(kt(e)) && test(e))?.entity_id;
  const sensor = (re, test = () => true) => pk("sensor", re, test);
  const not = (re) => (e) => !re.test(kt(e));
  // A binary sensor by its device class (Duplicati's running and problem sensors), else by its name.
  const binary = (cls, re) => list.find((e) => domainOf(e.entity_id) === "binary_sensor" && deviceClass(hass, e.entity_id) === cls && not(/stale|connect/)(e))?.entity_id || pk("binary_sensor", re);
  const specific = pk("button", /trigger_backup|create_backup|start_backup|backup_now|run_backup|backup_all/);
  return {
    last: sensor(/last_successful|last_success|last_backup|backup_last|last_run|last_completed|lastbackup/, (e) => time(e) && not(NOT_LAST)(e)),
    attempt: sensor(/last_attempt/, time),
    failure: sensor(/last_failure|last_fail/, time),
    status: sensor(/manager_state|status|state|result/, (e) => !time(e) && not(/size|count|next|guests_without/)(e)),
    next: sensor(/next/, (e) => time(e) && not(/purge/)(e)),
    size: sensor(/target_size|backup_size/, not(/total/)) || sensor(/size/, not(/free|total|destination|remaining|source|added/)) || sensor(/size/, not(/free|destination/)),
    running: binary("running", /running|in_progress|backing_up|current_status/),
    failed: binary("problem", /fail|error|last_status|last_backup_status/),
    // Proxmox: only a button that says it backs up, never a power button.
    button: specific || (strict ? null : pk("button", /backup|run|start|trigger|create|now/, not(OTHER_TASK))),
  };
};

// Sensors of backup add-ons, set through Home Assistant's API (no registry entry), by what their attributes say:
// read(state) gives { last, next, size, running, failed, late }.
export const lc = (s) => String(s?.state ?? "").toLowerCase();
export const ADDONS = {
  // Google Drive Backup: sensor.backup_state, backed_up / error / waiting; its last and next backups in attributes.
  google_drive_backup: {
    test: (a) => "last_backup" in a && ("next_backup" in a || "backups_in_google_drive" in a),
    read: (s, a) => ({ last: parseTime(a.last_backup), next: parseTime(a.next_backup), size: toBytes(a.size_in_google_drive ?? a.size_in_home_assistant), failed: lc(s) === "error" }),
  },
  // Samba Backup: sensor.samba_backup, IDLE / RUNNING / SUCCEEDED / FAILED; the last good backup ("2026-11-16 04:00").
  samba_backup: {
    test: (a) => "total_backups_succeeded" in a || ("backups_local" in a && "backups_remote" in a),
    read: (s, a) => ({ last: parseTime(a.last_backup), running: lc(s) === "running", failed: lc(s) === "failed" }),
  },
  // OneDrive Backup: sensor.onedrivebackup, Syncing / Backed_Up / Backed_Up_Local / Backed_Up_Onedrive / Stale.
  onedrive_backup: {
    test: (a) => "Last OneDrive backup date" in a || "Backups in OneDrive" in a,
    read: (s, a) => ({ last: parseTime(a["Last OneDrive backup date"] ?? a["Last Local backup date"]), running: lc(s) === "syncing", late: lc(s) === "stale" }),
  },
};
export const addonOf = (s) => (s?.entity_id?.startsWith("sensor.") ? Object.keys(ADDONS).find((k) => ADDONS[k].test(s.attributes || {})) || null : null);

export const _cache = new WeakMap();

// Whether Home Assistant's own backups have a last successful one (its entity looked up once per registry).
export const _ownCache = new WeakMap();
export const ownBackupDated = (hass) => {
  const ents = hass?.entities;
  if (!ents) return false;
  if (!_ownCache.has(ents)) {
    const own = Object.values(ents).find((e) => e.platform === "backup" && /last_successful/.test(e.translation_key || e.entity_id));
    _ownCache.set(ents, own?.entity_id ?? null);
  }
  const id = _ownCache.get(ents);
  return id ? parseTime(hass.states[id]?.state) !== null : false;
};

// A source: { key, platform, name, sub, parts (entity ids), drive (entity id of an add-on's sensor), maxAge (ms),
// button, run }.
export const source = (hass, platform, list, extra = {}) => {
  const p = PLATFORMS[platform];
  const parts = findParts(hass, list, PROXMOX.has(platform));
  const dev = list[0]?.device_id ? hass.devices?.[list[0].device_id] : null;
  const devLabel = devName(dev);
  const own = platform === "backup" || platform === "auto_backup";
  return {
    key: extra.entity || dev?.id || list[0]?.device_id || list[0]?.entity_id,
    platform,
    name: extra.name || (own ? p?.name : devLabel) || p?.name || nameOf(hass, parts.last),
    sub: own ? "" : p?.name && p.name !== (extra.name || devLabel) ? p.name : "",
    parts,
    maxAge: (Number(extra.max_age) || 0) * 3.6e6 || null,
    button: extra.button || parts.button || null,
    run: p ? p.run : parts.button ? "button" : null,
  };
};

// The sources of the configuration (`backups`: their "last backup" sensors, or the add-on's sensor), else those of
// every supported integration found, then any other sensor of a last backup time.
export const resolve = (hass, config) => {
  let per = _cache.get(hass.entities);
  if (!per) _cache.set(hass.entities, (per = new Map()));
  // Home Assistant's own last backup is in the key: Auto Backup is listed only until it has one.
  const sig = `${JSON.stringify(config.backups)}|${Object.keys(hass.states).length}|${ownBackupDated(hass)}`;
  if (per.has(sig)) return per.get(sig);
  const entries = Object.values(hass.entities || {}).filter((e) => hass.states[e.entity_id]);
  const deviceList = (e) => (e.device_id ? byDevice(hass).get(e.device_id) || [e] : [e]);
  // An add-on's sensor; Samba Backup is started through the add-on's input when its slug is given (`addon`).
  const drive = (id, kind, extra = {}) => {
    const run = extra.button ? "button" : kind === "samba_backup" && extra.addon ? ["hassio", "addon_stdin", { addon: extra.addon, input: "trigger" }] : null;
    return { key: id, platform: kind, name: extra.name || PLATFORMS[kind].name, sub: "", parts: {}, drive: id, maxAge: (Number(extra.max_age) || 0) * 3.6e6 || null, button: extra.button || null, run };
  };
  const sources = [];
  if (config.backups) {
    for (const x of asList(config.backups).map((b) => (typeof b === "string" ? { entity: b } : b))) {
      if (!x?.entity || !hass.states[x.entity]) continue;
      const kind = addonOf(hass.states[x.entity]);
      if (kind) {
        sources.push(drive(x.entity, kind, x));
        continue;
      }
      const e = hass.entities?.[x.entity] || { entity_id: x.entity };
      const src = source(hass, PLATFORMS[e.platform] ? e.platform : null, deviceList(e), x);
      src.parts.last = x.entity;
      sources.push(src);
    }
  } else {
    const used = new Set();
    for (const platform of Object.keys(PLATFORMS)) {
      if (ADDONS[platform]) {
        for (const s of Object.values(hass.states)) if (addonOf(s) === platform) sources.push(drive(s.entity_id, platform));
        continue;
      }
      // Auto Backup makes Home Assistant backups too: listed once, by Home Assistant's own backups when they report a
      // backup (the backup integration is always there, often unused when Auto Backup makes them).
      if (platform === "auto_backup" && sources.some((x) => x.platform === "backup" && parseTime(hass.states[x.parts.last]?.state) !== null)) continue;
      const groups = new Map();
      for (const e of entries.filter((x) => x.platform === platform)) {
        const k = e.device_id || e.entity_id;
        if (!groups.has(k)) groups.set(k, deviceList(e));
      }
      for (const [k, list] of groups) {
        const src = source(hass, platform, list);
        if (!src.parts.last && !src.parts.status) continue;
        used.add(k);
        sources.push(src);
      }
    }
    // Any other integration: a sensor of a last backup time, with the parts of its device.
    for (const e of entries) {
      if (PLATFORMS[e.platform] || used.has(e.device_id || e.entity_id) || domainOf(e.entity_id) !== "sensor") continue;
      const text = keyText(e, hass);
      if (!/backup|sauvegarde|snapshot/.test(text) || !/last|dernier/.test(text) || NOT_LAST.test(text) || deviceClass(hass, e.entity_id) !== "timestamp") continue;
      used.add(e.device_id || e.entity_id);
      const src = source(hass, null, deviceList(e));
      src.parts.last = e.entity_id;
      sources.push(src);
    }
  }
  per.set(sig, sources);
  return sources;
};

// The state of a source now: { last, next, size, failedAt, running, failed, status, age, limit }. `status` is
// running, failed, late (older than its limit, or the scheduled backup missed by an hour), ok, or unknown.
export const RUNNING_TEXT = /running|in_progress|create_backup|backing_up|started|active/;
export const FAILED_TEXT = /error|fail|fault/;
export const sourceState = (hass, src, { now = Date.now(), maxAge = MAX_AGE_H * 3.6e6, started = 0 } = {}) => {
  const st = (id) => (id ? hass.states[id] : null);
  const time = (id) => parseTime(st(id)?.state);
  const out = { last: null, next: null, size: null, failedAt: null, running: false, failed: false };
  let stale = false;
  if (src.drive) {
    const s = st(src.drive);
    const r = (ADDONS[src.platform] || ADDONS.google_drive_backup).read(s, s?.attributes || {});
    out.last = r.last ?? null;
    out.next = r.next ?? null;
    out.size = r.size ?? null;
    out.running = !!r.running;
    out.failed = !!r.failed;
    stale = !!r.late;
    if (out.failed) out.failedAt = parseTime(s?.last_changed);
  } else {
    const p = src.parts;
    out.last = time(p.last);
    out.next = time(p.next);
    const size = st(p.size);
    out.size = size && valid(size) ? toBytes(size.state, size.attributes?.unit_of_measurement || "B") : null;
    const text = String(st(p.status)?.state ?? "").toLowerCase();
    const attempt = time(p.attempt);
    const failure = time(p.failure);
    out.running = st(p.running)?.state === "on" || RUNNING_TEXT.test(text);
    out.failed = st(p.failed)?.state === "on" || FAILED_TEXT.test(text) || (attempt !== null && attempt > (out.last ?? 0) + 6e4) || (failure !== null && failure > (out.last ?? 0));
    if (out.failed) out.failedAt = failure ?? attempt ?? parseTime(st(p.status)?.last_changed);
  }
  // Started from the card: running until the source reports a newer backup (RUN_MS at most).
  if (started && now - started < RUN_MS && (out.last ?? 0) < started) out.running = true;
  out.limit = src.maxAge || maxAge;
  out.age = out.last === null ? null : now - out.last;
  if (out.running) out.status = "running";
  else if (out.failed) out.status = "failed";
  else if (out.last === null) out.status = "unknown";
  else if (stale || out.age > out.limit || (out.next !== null && out.next < now - 3.6e6)) out.status = "late";
  else out.status = "ok";
  return out;
};

// Bytes in the largest binary unit that fits (base 1024, the ha-* charter): up to 2 decimals under 10, 1 under 100,
// none above, trailing zeros dropped ("1.33 GiB", "782 MiB", "23.3 GiB").
export const SIZE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"];
export const fmtSize = (bytes, locale) => {
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < SIZE_UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v)} ${SIZE_UNITS[i]}`;
};

export const RANK = { failed: 0, late: 1, unknown: 2, running: 3, ok: 4 };
export const CLS = { failed: "crit", late: "warn", unknown: "idle", running: "active", ok: "ok" };
