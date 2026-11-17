# Changelog

## 1.2.0 - 2026-11-17

### Features
- Illustrated header, 90 px on the full and the mini card: the home server and its backup disk on a concrete floor strip, linked to a cloud seen through the window, in the worst status: a green check when up to date, packets going up the link while a backup runs, an amber link when late, a red link, mark and server light when one failed, a grey link with no backup.
- Status pill on the banner, right after the title and in the icon's colour (Failed, Late, Running, Up to date…), on its own line under the subtitle when the title needs the room and its dot alone below 200 px; the subtitle keeps the counts. The picture steps aside below 260 px. The mini card's expand / collapse button is a 24 px frosted disc in the banner's top-right corner.
- The header icon (a cloud in a round badge) takes the colour of the worst status: green, blue while running, amber, red or grey; it opens the entity of the worst source.
- Night picture after sunset (`sun.sun`) or with a dark theme; `illustration_theme: day | night` forces one, `illustration: false` keeps the classic header with its status chip, now right after the title too and under the subtitle, whole, on a narrow card (its dot alone below 200 px). Both options are in the visual editors and translated in every language; the animations honour `prefers-reduced-motion`.
- **Night picture with the dark theme even while the sun is up**: in `auto`, the banner shows the night picture when the sun is below the horizon or Home Assistant's theme is dark, and it switches at sunrise and sunset without waiting for another update.

## 1.1.0 - 2026-11-16

### Features
- Restyled in the common tile look of the other cards: a summary with an illustration of the worst status (the arrow into the cloud moves while a backup runs), the time since the newest good backup, the failed and late sources, the next backup and the total size.
- Rows as on the other cards: a round icon with the age ring and a status badge, the state in its color with the size and the next backup, and a "Back up" button with its label (round on narrow cards).
- Mini card with the illustration, the sources most in need first and a round back up now button.
- Samba Backup and OneDrive Backup add-ons: found by their sensors, with their state (running, failed, late) and last backup; Samba Backup can be started through the add-on's input (`addon` in `backups`).

### Fixes
- Proxmox VE: only the backup entities of a node are read, whatever the node or guest is called (even "pve-backup"). The node's status (running) and health (problem) no longer show a backup as running or failed, its power buttons are never offered as a back up button, and guests without backups no longer appear as sources.
- Auto Backup next to Home Assistant's own backups: Home Assistant's backups are listed once; Auto Backup is kept while Home Assistant's own backups have none.
- The back up button is disabled while its button entity is unavailable.

## 1.0.0 - 2026-11-16

First release.

### Features
- **Backup Card** (`custom:backup-card`): one row per backup source with the age of its last good backup in a ring against its limit, its status (up to date, late, failed, running), size and next scheduled backup, a summary of the newest backup, the next one and the total size, and back up now buttons.
- **Backup Mini Card** (`custom:backup-mini-card`): compact view with the worst source in a ring, the sources most in need first with their age, and a back up now button; the detail button switches to the full card.
- Home Assistant's backups, the Google Drive Backup add-on, Proxmox VE, Auto Backup, Duplicati, Duplicati Monitor, Backrest and Veeam found through the entity and device registries, plus any "last backup" sensor; each backup started its own way.
- Animation while a backup runs (an arc turning round its source).
- Visual editor for both cards; light and dark themes; 22 languages, English in the bundle and every other language in its own file loaded on demand.
