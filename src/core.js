/*
 * Backup Card for Home Assistant
 * https://github.com/juju35/ha-backup-card
 *
 * Lovelace cards for your backups: the age of the last good backup of each source against its limit, a status (up
 * to date, late, failed, running), its size, the next scheduled one, and a button that starts one. The sources come
 * from Home Assistant's own backups, the Google Drive Backup, Samba Backup and OneDrive Backup add-ons, Proxmox VE, Auto Backup, Duplicati, Duplicati
 * Monitor, Backrest and Veeam, found through the entity and device registries; any "last backup" sensor can also be
 * set in the configuration.
 */

export const VERSION = "__VERSION__";

export const CARD_ICONS = {
  backup:
    "M12,3A9,9 0 0,0 3,12H0L4,16L8,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19C10.5,19 9.09,18.5 7.94,17.7L6.5,19.14C8.04,20.3 9.94,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3M14,12A2,2 0 0,0 12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12Z",
  home: "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
  cloud: "M19.35,10.04C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.04C2.34,8.36 0,10.91 0,14A6,6 0 0,0 6,20H19A5,5 0 0,0 24,15C24,12.36 21.95,10.22 19.35,10.04Z",
  server:
    "M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z",
  archive: "M3,3H21V7H3V3M4,8H20V21H4V8M9.5,11A0.5,0.5 0 0,0 9,11.5V13H15V11.5A0.5,0.5 0 0,0 14.5,11H9.5Z",
  database: "M12,3C7.58,3 4,4.79 4,7C4,9.21 7.58,11 12,11C16.42,11 20,9.21 20,7C20,4.79 16.42,3 12,3M4,9V12C4,14.21 7.58,16 12,16C16.42,16 20,14.21 20,12V9C20,11.21 16.42,13 12,13C7.58,13 4,11.21 4,9M4,14V17C4,19.21 7.58,21 12,21C16.42,21 20,19.21 20,17V14C20,16.21 16.42,18 12,18C7.58,18 4,16.21 4,14Z",
  calendar: "M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z",
  shield: "M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1L21,5V11M12,21C15.75,20 19,15.54 19,11.22V6.3L12,3.18L5,6.3V11.22C5,15.54 8.25,20 12,21M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9",
  sync: "M12,18A6,6 0 0,1 6,12C6,11 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12A8,8 0 0,0 12,20V23L16,19L12,15M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13 17.75,13.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12A8,8 0 0,0 12,4Z",
};

// The integrations whose backups are found on their own, in this order: the icon of their rows, how a backup is
// started ([domain, service, data] for a service, "button" for the device's button that runs one), and the default
// limit of age, in hours (a daily backup is late after a day and two hours).
export const PLATFORMS = {
  backup: { name: "Home Assistant", icon: "home", run: ["backup", "create_automatic", {}] },
  google_drive_backup: { name: "Google Drive Backup", icon: "cloud", run: null },
  samba_backup: { name: "Samba Backup", icon: "server", run: null },
  onedrive_backup: { name: "OneDrive Backup", icon: "cloud", run: null },
  proxmoxve: { name: "Proxmox VE", icon: "server", run: null },
  // The Proxmox VE Custom fork (proxmox-homeassistant/proxmoxve-custom) registers its entities under its own domain.
  proxmoxve_custom: { name: "Proxmox VE", icon: "server", run: null },
  auto_backup: { name: "Auto Backup", icon: "home", run: ["auto_backup", "backup_full", {}] },
  duplicati: { name: "Duplicati", icon: "archive", run: "button" },
  duplicati_monitor: { name: "Duplicati", icon: "archive", run: null },
  backrest: { name: "Backrest", icon: "database", run: "button" },
  veeam_br: { name: "Veeam", icon: "server", run: "button" },
};
// The Proxmox VE platforms, whose nodes and guests carry status, health and power entities next to the backup ones.
export const PROXMOX = new Set(["proxmoxve", "proxmoxve_custom"]);
export const MAX_AGE_H = 26;
// How long the card says a backup runs after it was started from the card, unless the source says it is done.
export const RUN_MS = 120e3;
