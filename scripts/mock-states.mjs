// Mock Home Assistant registries and states for the screenshots and the tests: Home Assistant's own backups (with
// their next scheduled one and size), the Google Drive Backup add-on's sensor, a Proxmox VE node whose last backup is
// a week old, a Duplicati Monitor job that failed and a Backrest plan backed up this morning. Entity ids are in
// French on purpose (the cards never rely on them); the names shown are neutral English ones. Every time is relative
// to NOW, a fixed instant, so that the captures never change. `mockData(variant)` returns everything a card needs for
// one capture.
export const NOW = Date.parse("2026-11-16T10:00:00Z");
const iso = (ms) => new Date(ms).toISOString();
const H = 3.6e6;

const base = () => {
  const states = {};
  const entities = {};
  const devices = {
    ha: { id: "ha", name: "Backup", name_by_user: null },
    pve: { id: "pve", name: "Node pve", name_by_user: null },
    docs: { id: "docs", name: "Documents", name_by_user: null },
    photos: { id: "photos", name: "Photos", name_by_user: null },
  };
  const entity = (entity_id, state, attributes, { platform, device_id = null, translation_key = null, changed = NOW - H } = {}) => {
    if (platform) entities[entity_id] = { entity_id, device_id, platform, translation_key };
    states[entity_id] = { entity_id, state: String(state), attributes, last_changed: iso(changed), last_updated: iso(changed) };
  };
  const ts = (name) => ({ friendly_name: name, device_class: "timestamp" });
  // Home Assistant's backups: an automatic backup every night at 4:45.
  const ha = { platform: "backup", device_id: "ha" };
  entity("sensor.sauvegarde_etat", "idle", { friendly_name: "Backup Backup Manager state", device_class: "enum" }, { ...ha, translation_key: "backup_manager_state" });
  entity("sensor.sauvegarde_prochaine", iso(Date.parse("2026-11-17T04:45:00Z")), ts("Backup Next scheduled automatic backup"), { ...ha, translation_key: "next_scheduled_automatic_backup" });
  entity("sensor.sauvegarde_derniere", iso(Date.parse("2026-11-16T04:52:00Z")), ts("Backup Last successful automatic backup"), { ...ha, translation_key: "last_successful_automatic_backup" });
  entity("sensor.sauvegarde_tentative", iso(Date.parse("2026-11-16T04:52:00Z")), ts("Backup Last attempted automatic backup"), { ...ha, translation_key: "last_attempted_automatic_backup" });
  entity("sensor.sauvegarde_taille", "1432.6", { friendly_name: "Backup Last successful automatic backup size", unit_of_measurement: "MB", device_class: "data_size" }, { ...ha, translation_key: "last_successful_automatic_backup_size" });
  // The Google Drive Backup add-on: no registry entry, its times in attributes.
  entity("sensor.backup_state", "backed_up", { friendly_name: "Backup State", last_backup: iso(Date.parse("2026-11-16T05:10:00Z")), next_backup: iso(Date.parse("2026-11-17T05:10:00Z")), backups_in_google_drive: 4, size_in_google_drive: "5.4 GB" });
  // Proxmox VE: the node's last backup a week ago.
  entity("sensor.pve_derniere_sauvegarde", iso(NOW - 7 * 24 * H - 2 * H), ts("Node pve Last backup"), { platform: "proxmoxve", device_id: "pve", translation_key: "node_backup_last_backup" });
  entity("sensor.pve_duree_sauvegarde", "1840", { friendly_name: "Node pve Backup duration", unit_of_measurement: "s", device_class: "duration" }, { platform: "proxmoxve", device_id: "pve", translation_key: "node_backup_duration" });
  // Duplicati Monitor: the documents job failed this night.
  const dm = { platform: "duplicati_monitor", device_id: "docs" };
  entity("sensor.documents_statut", "Error", { friendly_name: "Documents Status" }, { ...dm, translation_key: "status", changed: Date.parse("2026-11-16T02:00:00Z") });
  entity("sensor.documents_derniere", iso(Date.parse("2026-11-15T02:03:00Z")), ts("Documents Last backup"), { ...dm, translation_key: "last_backup" });
  entity("sensor.documents_taille", "18.2", { friendly_name: "Documents Backup size", unit_of_measurement: "GB", device_class: "data_size" }, { ...dm, translation_key: "backup_size" });
  entity("sensor.documents_total", "64.9", { friendly_name: "Documents Total backup size", unit_of_measurement: "GB", device_class: "data_size" }, { ...dm, translation_key: "total_backup_size" });
  entity("sensor.documents_libre", "812", { friendly_name: "Documents Destination free space", unit_of_measurement: "GB", device_class: "data_size" }, { ...dm, translation_key: "destination_free_space" });
  // Backrest: the photos plan, backed up this morning, with its trigger button.
  const br = { platform: "backrest", device_id: "photos" };
  entity("sensor.photos_derniere", iso(Date.parse("2026-11-16T07:20:00Z")), ts("Photos Last backup time"), { ...br, translation_key: "last_backup_time" });
  entity("binary_sensor.photos_en_cours", "off", { friendly_name: "Photos Is running" }, { ...br, translation_key: "is_running" });
  entity("button.photos_elaguer", "unknown", { friendly_name: "Photos Run prune" }, { ...br, translation_key: "run_prune" });
  entity("binary_sensor.photos_echec", "off", { friendly_name: "Photos Last backup failed", device_class: "problem" }, { ...br, translation_key: "last_backup_failed" });
  entity("button.photos_lancer", "unknown", { friendly_name: "Photos Trigger backup" }, { ...br, translation_key: "trigger_backup" });
  return { states, entities, devices, areas: {}, api: {}, ws: {}, subs: {} };
};

// The variants of the captures:
//   default — as above: three up to date, one late, one failed
//   running — Home Assistant and Backrest are backing up, the others up to date (the banner shows the packets)
//   ok      — everything up to date
export const mockData = (variant = "default") => {
  const d = base();
  if (variant === "running") {
    d.states["sensor.sauvegarde_etat"].state = "create_backup";
    d.states["binary_sensor.photos_en_cours"].state = "on";
  }
  if (variant === "ok" || variant === "running") {
    d.states["sensor.pve_derniere_sauvegarde"].state = iso(Date.parse("2026-11-16T01:00:00Z"));
    d.states["sensor.documents_statut"].state = "Success";
    d.states["sensor.documents_derniere"].state = iso(Date.parse("2026-11-16T02:04:00Z"));
  }
  return d;
};
