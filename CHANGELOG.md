# Changelog

## 1.1.0 - 2026-11-16

### Features
- Restyled in the common tile look of the other cards: a summary with an illustration of the worst status (the arrow into the cloud moves while a backup runs), the time since the newest good backup, the failed and late sources, the next backup and the total size.
- Rows as on the other cards: a round icon with the age ring and a status badge, the state in its color with the size and the next backup, and a "Back up" button with its label (round on narrow cards).
- Mini card with the illustration, the sources most in need first and a round back up now button.
- Samba Backup and OneDrive Backup add-ons: found by their sensors, with their state (running, failed, late) and last backup; Samba Backup can be started through the add-on's input (`addon` in `backups`).

### Fixes
- Proxmox VE: only the backup entities of a node are read. The node's status (running) and health (problem) no longer show a backup as running or failed, its power buttons are no longer offered as a back up button, and guests without backups no longer appear as sources.
- Auto Backup next to Home Assistant's own backups: Home Assistant's backups are listed once.

## 1.0.0 - 2026-11-16

First release.

### Features
- **Backup Card** (`custom:backup-card`): one row per backup source with the age of its last good backup in a ring against its limit, its status (up to date, late, failed, running), size and next scheduled backup, a summary of the newest backup, the next one and the total size, and back up now buttons.
- **Backup Mini Card** (`custom:backup-mini-card`): compact view with the worst source in a ring, the sources most in need first with their age, and a back up now button; the detail button switches to the full card.
- Home Assistant's backups, the Google Drive Backup add-on, Proxmox VE, Auto Backup, Duplicati, Duplicati Monitor, Backrest and Veeam found through the entity and device registries, plus any "last backup" sensor; each backup started its own way.
- Animation while a backup runs (an arc turning round its source).
- Visual editor for both cards; light and dark themes; 22 languages, English in the bundle and every other language in its own file loaded on demand.
