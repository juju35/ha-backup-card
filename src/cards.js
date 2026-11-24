// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
import { MAX_AGE_H, PLATFORMS, RUN_MS } from "./core.js";
import { ICONS, clamp, esc, fmtSpan, fmtWhen, moreInfo, svgIcon } from "./helpers.js";
import { BASE_STYLE, MINI_STYLE, ring } from "./styles.js";
import { CardBase, withMini } from "./card-base.js";
import { CLS, RANK, fmtSize, ownBackupDated, resolve, sourceState } from "./discovery.js";
import { BACKUP_STYLE, art } from "./styles-2.js";
import { BK_BANNER_STYLE, bkIsNight, bkSceneSvg } from "./illustrated-header.js";

export let bkUid = 0;

export class BackupCard extends CardBase {
  static getConfigElement() {
    return document.createElement("backup-card-editor");
  }

  getCardSize() {
    return 5;
  }

  _build() {
    return resolve(this._hass, this._config);
  }

  // Auto Backup is dropped once Home Assistant's own backups have one: the model follows without a registry change.
  _modelExtra() {
    return ownBackupDated(this._hass);
  }

  _entityIds(m) {
    return m.flatMap((src) => (src.drive ? [src.drive] : Object.values(src.parts).filter(Boolean)));
  }

  _extraDeps() {
    return [this._startedAt];
  }

  _emptyKey(m) {
    return m.length ? null : "no_data";
  }

  // Every source with its state now; `worst` first.
  _items(m) {
    const maxAge = (Number(this._config.max_age) || MAX_AGE_H) * 3.6e6;
    const items = m.map((src) => ({ src, ...sourceState(this._hass, src, { maxAge, started: this._started?.get(src.key) || 0 }) }));
    const worst = [...items].sort((a, b) => RANK[a.status] - RANK[b.status])[0];
    return { items, worst };
  }

  _summary(m) {
    const { items, worst } = this._items(m);
    const count = (s) => items.filter((x) => x.status === s).length;
    const parts = [];
    for (const s of ["failed", "late", "running"]) if (count(s)) parts.push(this._t(`n_${s}`, { n: count(s) }));
    const sub = parts.length ? parts.join(" · ") : count("ok") === items.length ? this._t("all_ok") : "";
    const chip = { cls: CLS[worst.status], text: this._t(worst.status), entity: worst.src.drive || worst.src.parts.status || worst.src.parts.last };
    return { items, worst, sub, chip };
  }

  _icon(src) {
    return ICONS[PLATFORMS[src.platform]?.icon || "archive"];
  }

  // The button that starts a backup of a source, when there is a way to (`show_run: false` hides it): a pill with a
  // label in the rows, a round button in the mini card.
  _runButton(it, round = false) {
    const src = it.src;
    if (this._config.show_run === false || !(Array.isArray(src.run) || (src.button && this._s(src.button)))) return "";
    // A button entity that is unavailable cannot be pressed (one never pressed is "unknown", and fine).
    const off = !Array.isArray(src.run) && src.button && this._s(src.button)?.state === "unavailable";
    const label = it.running ? this._t("running") : this._t("run_backup");
    const text = it.running ? this._t("running") : this._t("back_up");
    return `<button class="btn${round ? " round" : ""}${it.running ? " active" : round ? " primary" : ""}" data-action="run" data-key="${esc(src.key)}" title="${esc(label)}" aria-label="${esc(`${label} · ${src.name}`)}"${
      it.running || off ? " disabled" : ""
    }>${svgIcon(it.running ? ICONS.sync : ICONS.play, it.running ? "turn" : "")}${round ? "" : `<span>${esc(text)}</span>`}</button>`;
  }

  // The round icon of a source: the age of its last good backup against its limit as a ring, a badge with its status.
  _icon_(it) {
    const p = it.age === null ? 0 : clamp(1 - it.age / it.limit, 0.04, 1);
    const badge = { failed: [ICONS.alert, "crit"], late: [ICONS.alert, "warn"], ok: [ICONS.check, "ok"], running: [ICONS.sync, "active"] }[it.status];
    const ringHtml = it.running ? '<span class="spin" aria-hidden="true"></span>' : ring(44, 3, it.status === "failed" || it.status === "late" ? 1 : p);
    return `<div class="row-icon ${CLS[it.status]}">${ringHtml}${svgIcon(this._icon(it.src))}${
      badge ? `<span class="badge" style="--b: var(--bk-${badge[1]})">${svgIcon(badge[0])}</span>` : ""
    }</div>`;
  }

  _age(it) {
    return it.age === null ? this._t("never") : fmtSpan(this._hass, this._config, it.age);
  }

  _state(it) {
    const when = (ms) => fmtWhen(this._hass, this._config, ms);
    if (it.status === "running") return this._t("running");
    if (it.status === "failed") return it.failedAt ? this._t("failed_at", { when: when(it.failedAt) }) : this._t("failed");
    if (it.status === "late") return this._t("late_limit", { limit: fmtSpan(this._hass, this._config, it.limit) });
    return it.last ? this._t("last_at", { when: when(it.last) }) : this._t("unknown");
  }

  _row(it) {
    const c = this._config;
    const src = it.src;
    const when = (ms) => fmtWhen(this._hass, this._config, ms);
    const state = [
      this._state(it),
      c.show_size !== false && it.size ? fmtSize(it.size, this._locale()) : "",
      c.show_next !== false && it.next && it.next > Date.now() ? this._t("next", { when: when(it.next) }) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const target = src.drive || src.parts.last || src.parts.status;
    return `<div class="row">
      ${this._icon_(it)}
      <div class="row-text clickable"${moreInfo(target)}>
        <div class="row-name">${esc(src.name)}${src.sub ? `<small>${esc(src.sub)}</small>` : ""}</div>
        <div class="row-state ${CLS[it.status]}">${esc(state)}</div>
      </div>
      ${this._runButton(it)}
    </div>`;
  }

  // The hero: the illustration with the worst status, how long since the newest good backup, then a line for the
  // first failed and the first late source, and one for the next backup and the total size.
  _hero(sum) {
    const lasts = sum.items.filter((x) => x.last !== null).sort((a, b) => b.last - a.last);
    const newest = lasts[0];
    const nexts = sum.items.filter((x) => x.next !== null && x.next > Date.now()).sort((a, b) => a.next - b.next);
    const total = sum.items.reduce((n, x) => n + (x.size || 0), 0);
    const failed = sum.items.find((x) => x.status === "failed");
    const late = sum.items.find((x) => x.status === "late");
    const when = (ms) => fmtWhen(this._hass, this._config, ms);
    const line = (cls, icon, text) => `<div class="line ${cls}">${svgIcon(icon)}<span>${esc(text)}</span></div>`;
    const lines = [];
    if (failed) lines.push(line("crit", ICONS.alert, this._t("src_failed", { name: failed.src.name, when: failed.failedAt ? when(failed.failedAt) : "" }).trim()));
    if (late) lines.push(line("warn", ICONS.alert, this._t("src_late", { name: late.src.name, limit: fmtSpan(this._hass, this._config, late.limit) })));
    if (!failed && !late) lines.push(line("ok", ICONS.check, this._t("all_ok")));
    const more = [nexts[0] ? this._t("next", { when: when(nexts[0].next) }) : "", total ? fmtSize(total, this._locale()) : ""].filter(Boolean).join(" · ");
    if (more) lines.push(line("", ICONS.calendar, more));
    const big = newest
      ? `<div class="big ${sum.worst.status === "ok" ? "ok" : "idle"}">${svgIcon(ICONS.shield)}<b>${esc(fmtSpan(this._hass, this._config, Date.now() - newest.last))}</b><span>${esc(this._t("since_good"))}</span></div>`
      : `<div class="big crit">${svgIcon(ICONS.alert)}<b>${esc(this._t("never"))}</b></div>`;
    return `<div class="hero"><div class="hero-art">${art(sum.worst.status, sum.items.some((x) => x.running))}</div><div class="hero-body">${big}${lines.join("")}</div></div>`;
  }

  // The state the banner shows: the worst one, running when a backup runs and none failed or is late.
  _sceneState(sum) {
    const w = sum.worst.status;
    if (w === "failed" || w === "late") return w;
    if (sum.items.some((x) => x.running)) return "running";
    return w === "ok" ? "ok" : "idle";
  }

  // The illustrated banner (`illustration: false`: the classic header, with the status chip). On the banner the
  // status is the icon's color and the subtitle; the icon opens the entity the chip would open.
  _head(sum, sub) {
    const c = this._config;
    const title = c.title || this._t("backups");
    if (c.illustration === false) return this._header({ icon: ICONS.backup, cls: CLS[sum.worst.status], title, sub, chip: sum.chip });
    this._uid ??= ++bkUid;
    const state = this._sceneState(sum);
    const cls = { ok: "ok", running: "active", late: "warn", failed: "crit", idle: "idle" }[state];
    // The status pill in the icon's color; the subtitle keeps the counts (failed, late, running), never the status again.
    const label = state === "running" ? this._t("running") : sum.chip.text;
    const pill = `<span class="chip ${cls}${sum.chip.entity ? " clickable" : ""}"${moreInfo(sum.chip.entity)} title="${esc(label)}" aria-label="${esc(
      label,
    )}"><span class="dot"></span><span class="chip-text">${esc(label)}</span></span>`;
    return `<div class="banner bk-${state}${bkIsNight(this._hass, c) ? " night" : ""}">${bkSceneSvg(state, this._uid)}<div class="bk-ground" aria-hidden="true"></div>
      <div class="htext"><div class="type-icon ${cls}${sum.chip.entity ? " clickable" : ""}"${moreInfo(sum.chip.entity)} title="${esc(sum.chip.text)}" aria-label="${esc(sum.chip.text)}">${svgIcon(ICONS.cloud)}</div>
        <div class="titles"><div class="tline"><div class="name">${esc(title)}</div>${pill}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div></div>${this._zoomButton()}</div>`;
  }

  _bannerStyle() {
    return this._config.illustration === false ? "" : BK_BANNER_STYLE;
  }

  _render() {
    const { m, error } = this._ready();
    if (error) return error;
    const sum = this._summary(m);
    const parts = [];
    if (this._config.show_stats !== false) parts.push(this._hero(sum));
    parts.push(this._section("backups", ICONS.database, this._t("backups"), sum.items.length, `<div class="rows">${sum.items.map((it) => this._row(it)).join("")}</div>`));
    return `<style>${BASE_STYLE}${BACKUP_STYLE}${this._bannerStyle()}</style>
      <ha-card>
        ${this._head(sum, sum.sub)}
        <div class="content">${parts.join("")}</div>
      </ha-card>`;
  }

  _onDisconnect() {
    clearTimeout(this._runTimer);
  }

  _action(action, el) {
    if (action !== "run") return false;
    const src = this._resolve()?.find((x) => x.key === el.dataset.key);
    if (!src) return false;
    if (Array.isArray(src.run)) this._call(src.run[0], src.run[1], { ...src.run[2] });
    else if (src.button) this._call("button", "press", { entity_id: src.button });
    else return false;
    this._started = new Map(this._started).set(src.key, Date.now());
    this._startedAt = Date.now();
    // Drawn again once the time a backup is shown running is over.
    clearTimeout(this._runTimer);
    this._runTimer = setTimeout(() => {
      this._lastDeps = null;
      this._update();
    }, RUN_MS + 50);
    this._update();
    return true;
  }
}

export class BackupMiniCard extends withMini(BackupCard) {
  static getConfigElement() {
    return document.createElement("backup-mini-card-editor");
  }

  _renderMini() {
    const { m, error } = this._ready();
    if (error) return error;
    const sum = this._summary(m);
    const sorted = [...sum.items].sort((a, b) => RANK[a.status] - RANK[b.status]);
    const lines = sorted
      .slice(0, 3)
      .map(
        (it) =>
          `<div class="line ${CLS[it.status]} clickable"${moreInfo(it.src.drive || it.src.parts.last || it.src.parts.status)}>${svgIcon(it.status === "failed" ? ICONS.alert : it.running ? ICONS.sync : this._icon(it.src))}<span>${esc(
            it.src.name,
          )}</span><span class="num">${esc(this._age(it))}</span></div>`,
      )
      .join("");
    // The run button of the first source that can start a backup (Home Assistant's own first).
    const first = sum.items.find((it) => this._runButton(it, true));
    const controls = first ? this._runButton(first, true) : "";
    return `<style>${BASE_STYLE}${BACKUP_STYLE}${MINI_STYLE}${this._bannerStyle()}</style>
      <ha-card>
        ${this._head(sum, "")}
        <div class="content mini">
          <div class="mini-art">${art(sum.worst.status, sum.items.some((x) => x.running))}</div>
          <div class="info">${lines}</div>
          ${controls ? `<div class="controls">${controls}</div>` : ""}
        </div>
      </ha-card>`;
  }
}
