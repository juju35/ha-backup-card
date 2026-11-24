// ---------------------------------------------------------------------------
// Visual editors
// ---------------------------------------------------------------------------
import { VERSION } from "./core.js";
import { asList, t } from "./helpers.js";
import { EditorBase } from "./visual-editors.js";
import { register } from "./register.js";
import { BackupCard, BackupMiniCard } from "./cards.js";

export class BackupCardEditor extends EditorBase {
  static get toggles() {
    return [
      ["illustration", true],
      ["show_title", true],
      ["show_subtitle", true],
      ["show_stats", true],
      ["show_size", true],
      ["show_next", true],
      ["show_run", true],
    ];
  }

  static get sections() {
    return ["backups"];
  }

  static get defaults() {
    return { illustration_theme: "auto" };
  }

  // A list of sources with their own options (`{ entity, name, max_age, button, addon }`) is YAML only: the entity
  // picker would show them as unknown entities and drop their options on the next change.
  _yamlBackups() {
    return asList(this._config.backups).some((b) => b && typeof b === "object");
  }

  _schemaKey() {
    return this._yamlBackups() ? "yaml" : "";
  }

  _fields() {
    const tr = (k) => t(this._hass, this._config, k);
    return [
      ...(this._yamlBackups() ? [] : [{ name: "backups", selector: { entity: { multiple: true, domain: "sensor" } } }]),
      { name: "max_age", selector: { number: { min: 1, max: 24 * 60, mode: "box", unit_of_measurement: "h" } } },
      { name: "illustration_theme", selector: { select: { mode: "dropdown", options: ["auto", "day", "night"].map((value) => ({ value, label: tr(`theme_${value}`) })) } } },
    ];
  }
}

// The mini card's detail view is the full card: its editor offers the full card's options, plus the detail button.
export class BackupMiniCardEditor extends BackupCardEditor {
  static get toggles() {
    return [...BackupCardEditor.toggles, ["zoom", true]];
  }
}

register(
  [
    ["backup-card", BackupCard, { name: "Backup Card", description: "Backups of Home Assistant, Proxmox VE, Duplicati, Backrest and more: age against a limit, status, size, next run." }],
    ["backup-mini-card", BackupMiniCard, { name: "Backup Mini Card", description: "Compact backups: the worst status, the sources and their age, and a back-up-now button." }],
    ["backup-card-editor", BackupCardEditor],
    ["backup-mini-card-editor", BackupMiniCardEditor],
  ],
  "https://github.com/juju35/ha-backup-card",
);

console.info(`%c BACKUP-CARD %c v${VERSION} `, "color: white; background: #546e7a; font-weight: 700;", "color: #546e7a; background: white; font-weight: 700;");
