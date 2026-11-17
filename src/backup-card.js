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

const VERSION = "__VERSION__";

const CARD_ICONS = {
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
const PLATFORMS = {
  backup: { name: "Home Assistant", icon: "home", run: ["backup", "create_automatic", {}] },
  google_drive_backup: { name: "Google Drive Backup", icon: "cloud", run: null },
  samba_backup: { name: "Samba Backup", icon: "server", run: null },
  onedrive_backup: { name: "OneDrive Backup", icon: "cloud", run: null },
  proxmoxve: { name: "Proxmox VE", icon: "server", run: null },
  auto_backup: { name: "Auto Backup", icon: "home", run: ["auto_backup", "backup_full", {}] },
  duplicati: { name: "Duplicati", icon: "archive", run: "button" },
  duplicati_monitor: { name: "Duplicati", icon: "archive", run: null },
  backrest: { name: "Backrest", icon: "database", run: "button" },
  veeam_br: { name: "Veeam", icon: "server", run: "button" },
};
const MAX_AGE_H = 26;
// How long the card says a backup runs after it was started from the card, unless the source says it is done.
const RUN_MS = 120e3;

const STRINGS = {
  en: {
    backups: "Backups",
    ok: "Up to date",
    late: "Late",
    failed: "Failed",
    running: "Running",
    unknown: "No backup",
    never: "Never",
    all_ok: "All up to date",
    n_failed: "{n} failed",
    n_late: "{n} late",
    n_running: "{n} running",
    failed_at: "Failed {when}",
    late_limit: "Older than {limit}",
    last_at: "Last {when}",
    next: "Next {when}",
    run_backup: "Back up now",
    no_data: "Nothing to show: no backup found.",
    backups_field: "Backups (their last backup sensors; empty: automatic)",
    max_age: "Maximum age",
    max_age_helper: "In hours: a backup older than this is late (default 26)",
    show_stats: "Show the summary",
    show_size: "Show the sizes",
    show_next: "Show the next backups",
    show_run: "Show the back up now buttons",
    back_up: "Back up",
    since_good: "since the last good backup",
    src_failed: "{name} failed {when}",
    src_late: "{name} older than {limit}",
    cancel: "Cancel",
    left: "{time} left",
    today_at: "today {time}",
    tomorrow_at: "tomorrow {time}",
    yesterday_at: "yesterday {time}",
    zoom_in: "Show details",
    zoom_out: "Show less",
    title: "Title (optional)",
    language: "Language",
    lang_auto: "Automatic",
    collapsed: "Sections folded by default",
    zoom: "Detail button",
    zoom_helper: "Switches the mini card to the full card's content",
    show_title: "Show title",
    show_subtitle: "Show subtitle",
    no_registry: "This card needs Home Assistant 2024.8 or later.",
    unavailable: "Unavailable",
    illustration: "Animated illustration",
    illustration_theme: "Illustration theme",
    theme_auto: "Automatic (sun or dark theme)",
    theme_day: "Day",
    theme_night: "Night",
  },
  fr: {
    backups: "Sauvegardes",
    ok: "À jour",
    late: "En retard",
    failed: "Échec",
    running: "En cours",
    unknown: "Aucune sauvegarde",
    never: "Jamais",
    all_ok: "Toutes à jour",
    n_failed: "{n} en échec",
    n_late: "{n} en retard",
    n_running: "{n} en cours",
    failed_at: "Échec {when}",
    late_limit: "Plus vieille que {limit}",
    last_at: "Dernière {when}",
    next: "Prochaine {when}",
    run_backup: "Sauvegarder maintenant",
    no_data: "Rien à afficher : aucune sauvegarde trouvée.",
    backups_field: "Sauvegardes (leurs capteurs de dernière sauvegarde ; vide : automatique)",
    max_age: "Âge maximal",
    max_age_helper: "En heures : une sauvegarde plus vieille est en retard (26 par défaut)",
    show_stats: "Afficher le résumé",
    show_size: "Afficher les tailles",
    show_next: "Afficher les prochaines sauvegardes",
    show_run: "Afficher les boutons Sauvegarder maintenant",
    back_up: "Sauvegarder",
    since_good: "depuis la dernière sauvegarde réussie",
    src_failed: "{name} en échec {when}",
    src_late: "{name} plus vieille que {limit}",
    cancel: "Annuler",
    left: "{time} restantes",
    today_at: "aujourd'hui {time}",
    tomorrow_at: "demain {time}",
    yesterday_at: "hier {time}",
    zoom_in: "Afficher les détails",
    zoom_out: "Réduire",
    title: "Titre (facultatif)",
    language: "Langue",
    lang_auto: "Automatique",
    collapsed: "Sections repliées par défaut",
    zoom: "Bouton détail",
    zoom_helper: "Bascule la mini-carte vers le contenu de la carte complète",
    show_title: "Afficher le titre",
    show_subtitle: "Afficher le sous-titre",
    no_registry: "Cette carte nécessite Home Assistant 2024.8 ou plus récent.",
    unavailable: "Indisponible",
    illustration: "Illustration animée",
    illustration_theme: "Thème de l’illustration",
    theme_auto: "Automatique (soleil ou thème sombre)",
    theme_day: "Jour",
    theme_night: "Nuit",
  },
  de: {
    backups: "Backups",
    ok: "Aktuell",
    late: "Verspätet",
    failed: "Fehlgeschlagen",
    running: "Läuft",
    unknown: "Kein Backup",
    never: "Nie",
    all_ok: "Alle aktuell",
    n_failed: "{n} fehlgeschlagen",
    n_late: "{n} verspätet",
    n_running: "{n} laufen",
    failed_at: "Fehlgeschlagen {when}",
    late_limit: "Älter als {limit}",
    last_at: "Zuletzt {when}",
    next: "Nächstes {when}",
    run_backup: "Jetzt sichern",
    no_data: "Nichts anzuzeigen: kein Backup gefunden.",
    backups_field: "Backups (ihre Sensoren des letzten Backups; leer: automatisch)",
    max_age: "Maximales Alter",
    max_age_helper: "In Stunden: ein älteres Backup ist verspätet (Standard 26)",
    show_stats: "Zusammenfassung anzeigen",
    show_size: "Größen anzeigen",
    show_next: "Nächste Backups anzeigen",
    show_run: "Schaltflächen „Jetzt sichern“ anzeigen",
    back_up: "Sichern",
    since_good: "seit dem letzten erfolgreichen Backup",
    src_failed: "{name} fehlgeschlagen {when}",
    src_late: "{name} älter als {limit}",
    cancel: "Abbrechen",
    left: "Noch {time}",
    today_at: "heute {time}",
    tomorrow_at: "morgen {time}",
    yesterday_at: "gestern {time}",
    zoom_in: "Details anzeigen",
    zoom_out: "Weniger anzeigen",
    title: "Titel (optional)",
    language: "Sprache",
    lang_auto: "Automatisch",
    collapsed: "Standardmäßig eingeklappte Bereiche",
    zoom: "Detail-Schaltfläche",
    zoom_helper: "Schaltet die Mini-Karte auf den Inhalt der vollen Karte um",
    show_title: "Titel anzeigen",
    show_subtitle: "Untertitel anzeigen",
    no_registry: "Diese Karte benötigt Home Assistant 2024.8 oder neuer.",
    unavailable: "Nicht verfügbar",
    illustration: "Animierte Illustration",
    illustration_theme: "Thema der Illustration",
    theme_auto: "Automatisch (Sonne oder dunkles Design)",
    theme_day: "Tag",
    theme_night: "Nacht",
  },
  es: {
    backups: "Copias de seguridad",
    ok: "Al día",
    late: "Atrasada",
    failed: "Fallida",
    running: "En curso",
    unknown: "Sin copia",
    never: "Nunca",
    all_ok: "Todas al día",
    n_failed: "{n} fallidas",
    n_late: "{n} atrasadas",
    n_running: "{n} en curso",
    failed_at: "Fallida {when}",
    late_limit: "Más antigua que {limit}",
    last_at: "Última {when}",
    next: "Próxima {when}",
    run_backup: "Copiar ahora",
    no_data: "Nada que mostrar: no se encontró ninguna copia de seguridad.",
    backups_field: "Copias (sus sensores de última copia; vacío: automático)",
    max_age: "Edad máxima",
    max_age_helper: "En horas: una copia más antigua está atrasada (26 por defecto)",
    show_stats: "Mostrar el resumen",
    show_size: "Mostrar los tamaños",
    show_next: "Mostrar las próximas copias",
    show_run: "Mostrar los botones Copiar ahora",
    back_up: "Copiar",
    since_good: "desde la última copia correcta",
    src_failed: "{name} fallida {when}",
    src_late: "{name} más antigua que {limit}",
    cancel: "Cancelar",
    left: "Quedan {time}",
    today_at: "hoy {time}",
    tomorrow_at: "mañana {time}",
    yesterday_at: "ayer {time}",
    zoom_in: "Ver detalles",
    zoom_out: "Ver menos",
    title: "Título (opcional)",
    language: "Idioma",
    lang_auto: "Automático",
    collapsed: "Secciones plegadas por defecto",
    zoom: "Botón de detalle",
    zoom_helper: "Cambia la minitarjeta al contenido de la tarjeta completa",
    show_title: "Mostrar título",
    show_subtitle: "Mostrar subtítulo",
    no_registry: "Esta tarjeta necesita Home Assistant 2024.8 o posterior.",
    unavailable: "No disponible",
    illustration: "Ilustración animada",
    illustration_theme: "Tema de la ilustración",
    theme_auto: "Automático (sol o tema oscuro)",
    theme_day: "Día",
    theme_night: "Noche",
  },
  it: {
    backups: "Backup",
    ok: "Aggiornato",
    late: "In ritardo",
    failed: "Fallito",
    running: "In corso",
    unknown: "Nessun backup",
    never: "Mai",
    all_ok: "Tutti aggiornati",
    n_failed: "{n} falliti",
    n_late: "{n} in ritardo",
    n_running: "{n} in corso",
    failed_at: "Fallito {when}",
    late_limit: "Più vecchio di {limit}",
    last_at: "Ultimo {when}",
    next: "Prossimo {when}",
    run_backup: "Esegui backup ora",
    no_data: "Niente da mostrare: nessun backup trovato.",
    backups_field: "Backup (i loro sensori dell'ultimo backup; vuoto: automatico)",
    max_age: "Età massima",
    max_age_helper: "In ore: un backup più vecchio è in ritardo (predefinito 26)",
    show_stats: "Mostra il riepilogo",
    show_size: "Mostra le dimensioni",
    show_next: "Mostra i prossimi backup",
    show_run: "Mostra i pulsanti Esegui backup ora",
    back_up: "Esegui backup",
    since_good: "dall'ultimo backup riuscito",
    src_failed: "{name} fallito {when}",
    src_late: "{name} più vecchio di {limit}",
    cancel: "Annulla",
    left: "{time} rimanenti",
    today_at: "oggi {time}",
    tomorrow_at: "domani {time}",
    yesterday_at: "ieri {time}",
    zoom_in: "Mostra dettagli",
    zoom_out: "Mostra meno",
    title: "Titolo (facoltativo)",
    language: "Lingua",
    lang_auto: "Automatica",
    collapsed: "Sezioni chiuse per impostazione predefinita",
    zoom: "Pulsante dettagli",
    zoom_helper: "Passa la mini scheda al contenuto della scheda completa",
    show_title: "Mostra titolo",
    show_subtitle: "Mostra sottotitolo",
    no_registry: "Questa scheda richiede Home Assistant 2024.8 o successivo.",
    unavailable: "Non disponibile",
    illustration: "Illustrazione animata",
    illustration_theme: "Tema dell’illustrazione",
    theme_auto: "Automatico (sole o tema scuro)",
    theme_day: "Giorno",
    theme_night: "Notte",
  },
  nl: {
    backups: "Back-ups",
    ok: "Actueel",
    late: "Te laat",
    failed: "Mislukt",
    running: "Bezig",
    unknown: "Geen back-up",
    never: "Nooit",
    all_ok: "Alles actueel",
    n_failed: "{n} mislukt",
    n_late: "{n} te laat",
    n_running: "{n} bezig",
    failed_at: "Mislukt {when}",
    late_limit: "Ouder dan {limit}",
    last_at: "Laatste {when}",
    next: "Volgende {when}",
    run_backup: "Nu back-uppen",
    no_data: "Niets te tonen: geen back-up gevonden.",
    backups_field: "Back-ups (hun sensoren van de laatste back-up; leeg: automatisch)",
    max_age: "Maximale leeftijd",
    max_age_helper: "In uren: een oudere back-up is te laat (standaard 26)",
    show_stats: "Samenvatting tonen",
    show_size: "Groottes tonen",
    show_next: "Volgende back-ups tonen",
    show_run: "Knoppen Nu back-uppen tonen",
    back_up: "Back-up maken",
    since_good: "sinds de laatste geslaagde back-up",
    src_failed: "{name} mislukt {when}",
    src_late: "{name} ouder dan {limit}",
    cancel: "Annuleren",
    left: "Nog {time}",
    today_at: "vandaag {time}",
    tomorrow_at: "morgen {time}",
    yesterday_at: "gisteren {time}",
    zoom_in: "Details tonen",
    zoom_out: "Minder tonen",
    title: "Titel (optioneel)",
    language: "Taal",
    lang_auto: "Automatisch",
    collapsed: "Standaard ingeklapte secties",
    zoom: "Detailknop",
    zoom_helper: "Schakelt de minikaart naar de inhoud van de volledige kaart",
    show_title: "Titel tonen",
    show_subtitle: "Ondertitel tonen",
    no_registry: "Deze kaart vereist Home Assistant 2024.8 of nieuwer.",
    unavailable: "Niet beschikbaar",
    illustration: "Geanimeerde illustratie",
    illustration_theme: "Thema van de illustratie",
    theme_auto: "Automatisch (zon of donker thema)",
    theme_day: "Dag",
    theme_night: "Nacht",
  },
  pt: {
    backups: "Cópias de segurança",
    ok: "Em dia",
    late: "Atrasada",
    failed: "Falhou",
    running: "Em curso",
    unknown: "Sem cópia",
    never: "Nunca",
    all_ok: "Todas em dia",
    n_failed: "{n} falharam",
    n_late: "{n} atrasadas",
    n_running: "{n} em curso",
    failed_at: "Falhou {when}",
    late_limit: "Mais antiga que {limit}",
    last_at: "Última {when}",
    next: "Próxima {when}",
    run_backup: "Copiar agora",
    no_data: "Nada a mostrar: nenhuma cópia de segurança encontrada.",
    backups_field: "Cópias (os seus sensores da última cópia; vazio: automático)",
    max_age: "Idade máxima",
    max_age_helper: "Em horas: uma cópia mais antiga está atrasada (26 por omissão)",
    show_stats: "Mostrar o resumo",
    show_size: "Mostrar os tamanhos",
    show_next: "Mostrar as próximas cópias",
    show_run: "Mostrar os botões Copiar agora",
    back_up: "Copiar",
    since_good: "desde a última cópia bem-sucedida",
    src_failed: "{name} falhou {when}",
    src_late: "{name} mais antiga que {limit}",
    cancel: "Cancelar",
    left: "Faltam {time}",
    today_at: "hoje {time}",
    tomorrow_at: "amanhã {time}",
    yesterday_at: "ontem {time}",
    zoom_in: "Mostrar detalhes",
    zoom_out: "Mostrar menos",
    title: "Título (opcional)",
    language: "Idioma",
    lang_auto: "Automático",
    collapsed: "Secções recolhidas por predefinição",
    zoom: "Botão de detalhe",
    zoom_helper: "Muda o minicartão para o conteúdo do cartão completo",
    show_title: "Mostrar título",
    show_subtitle: "Mostrar subtítulo",
    no_registry: "Este cartão requer o Home Assistant 2024.8 ou posterior.",
    unavailable: "Indisponível",
    illustration: "Ilustração animada",
    illustration_theme: "Tema da ilustração",
    theme_auto: "Automático (sol ou tema escuro)",
    theme_day: "Dia",
    theme_night: "Noite",
  },
  pl: {
    backups: "Kopie zapasowe",
    ok: "Aktualna",
    late: "Opóźniona",
    failed: "Nieudana",
    running: "W toku",
    unknown: "Brak kopii",
    never: "Nigdy",
    all_ok: "Wszystkie aktualne",
    n_failed: "Nieudane: {n}",
    n_late: "Opóźnione: {n}",
    n_running: "W toku: {n}",
    failed_at: "Nieudana {when}",
    late_limit: "Starsza niż {limit}",
    last_at: "Ostatnia {when}",
    next: "Następna {when}",
    run_backup: "Utwórz kopię teraz",
    no_data: "Brak danych: nie znaleziono kopii zapasowej.",
    backups_field: "Kopie (ich czujniki ostatniej kopii; puste: automatycznie)",
    max_age: "Maksymalny wiek",
    max_age_helper: "W godzinach: starsza kopia jest opóźniona (domyślnie 26)",
    show_stats: "Pokaż podsumowanie",
    show_size: "Pokaż rozmiary",
    show_next: "Pokaż następne kopie",
    show_run: "Pokaż przyciski Utwórz kopię teraz",
    back_up: "Utwórz kopię",
    since_good: "od ostatniej udanej kopii",
    src_failed: "{name}: błąd {when}",
    src_late: "{name} starsza niż {limit}",
    cancel: "Anuluj",
    left: "Pozostało {time}",
    today_at: "dziś {time}",
    tomorrow_at: "jutro {time}",
    yesterday_at: "wczoraj {time}",
    zoom_in: "Pokaż szczegóły",
    zoom_out: "Pokaż mniej",
    title: "Tytuł (opcjonalnie)",
    language: "Język",
    lang_auto: "Automatycznie",
    collapsed: "Sekcje domyślnie zwinięte",
    zoom: "Przycisk szczegółów",
    zoom_helper: "Przełącza minikartę na zawartość pełnej karty",
    show_title: "Pokaż tytuł",
    show_subtitle: "Pokaż podtytuł",
    no_registry: "Ta karta wymaga Home Assistant 2024.8 lub nowszego.",
    unavailable: "Niedostępne",
    illustration: "Animowana ilustracja",
    illustration_theme: "Motyw ilustracji",
    theme_auto: "Automatycznie (słońce lub ciemny motyw)",
    theme_day: "Dzień",
    theme_night: "Noc",
  },
  sr: {
    backups: "Резервне копије",
    ok: "Ажурна",
    late: "Касни",
    failed: "Неуспешна",
    running: "У току",
    unknown: "Нема копије",
    never: "Никад",
    all_ok: "Све ажурне",
    n_failed: "Неуспешне: {n}",
    n_late: "Касне: {n}",
    n_running: "У току: {n}",
    failed_at: "Неуспешна {when}",
    late_limit: "Старија од {limit}",
    last_at: "Последња {when}",
    next: "Следећа {when}",
    run_backup: "Направи копију сада",
    no_data: "Нема шта да се прикаже: није пронађена резервна копија.",
    backups_field: "Копије (њихови сензори последње копије; празно: аутоматски)",
    max_age: "Највећа старост",
    max_age_helper: "У сатима: старија копија касни (подразумевано 26)",
    show_stats: "Прикажи сажетак",
    show_size: "Прикажи величине",
    show_next: "Прикажи следеће копије",
    show_run: "Прикажи дугмад Направи копију сада",
    back_up: "Направи копију",
    since_good: "од последње успешне копије",
    src_failed: "{name} није успела {when}",
    src_late: "{name} старија од {limit}",
    cancel: "Откажи",
    left: "Преостало {time}",
    today_at: "данас {time}",
    tomorrow_at: "сутра {time}",
    yesterday_at: "јуче {time}",
    zoom_in: "Прикажи детаље",
    zoom_out: "Прикажи мање",
    title: "Наслов (опционо)",
    language: "Језик",
    lang_auto: "Аутоматски",
    collapsed: "Подразумевано скупљени одељци",
    zoom: "Дугме за детаље",
    zoom_helper: "Пребацује мини картицу на садржај пуне картице",
    show_title: "Прикажи наслов",
    show_subtitle: "Прикажи поднаслов",
    no_registry: "Ова картица захтева Home Assistant 2024.8 или новији.",
    unavailable: "Недоступно",
    illustration: "Анимирана илустрација",
    illustration_theme: "Тема илустрације",
    theme_auto: "Аутоматски (сунце или тамна тема)",
    theme_day: "Дан",
    theme_night: "Ноћ",
  },
  "sr-Latn": {
    backups: "Rezervne kopije",
    ok: "Ažurna",
    late: "Kasni",
    failed: "Neuspešna",
    running: "U toku",
    unknown: "Nema kopije",
    never: "Nikad",
    all_ok: "Sve ažurne",
    n_failed: "Neuspešne: {n}",
    n_late: "Kasne: {n}",
    n_running: "U toku: {n}",
    failed_at: "Neuspešna {when}",
    late_limit: "Starija od {limit}",
    last_at: "Poslednja {when}",
    next: "Sledeća {when}",
    run_backup: "Napravi kopiju sada",
    no_data: "Nema šta da se prikaže: nije pronađena rezervna kopija.",
    backups_field: "Kopije (njihovi senzori poslednje kopije; prazno: automatski)",
    max_age: "Najveća starost",
    max_age_helper: "U satima: starija kopija kasni (podrazumevano 26)",
    show_stats: "Prikaži sažetak",
    show_size: "Prikaži veličine",
    show_next: "Prikaži sledeće kopije",
    show_run: "Prikaži dugmad Napravi kopiju sada",
    back_up: "Napravi kopiju",
    since_good: "od poslednje uspešne kopije",
    src_failed: "{name} nije uspela {when}",
    src_late: "{name} starija od {limit}",
    cancel: "Otkaži",
    left: "Preostalo {time}",
    today_at: "danas {time}",
    tomorrow_at: "sutra {time}",
    yesterday_at: "juče {time}",
    zoom_in: "Prikaži detalje",
    zoom_out: "Prikaži manje",
    title: "Naslov (opciono)",
    language: "Jezik",
    lang_auto: "Automatski",
    collapsed: "Podrazumevano skupljeni odeljci",
    zoom: "Dugme za detalje",
    zoom_helper: "Prebacuje mini karticu na sadržaj pune kartice",
    show_title: "Prikaži naslov",
    show_subtitle: "Prikaži podnaslov",
    no_registry: "Ova kartica zahteva Home Assistant 2024.8 ili noviji.",
    unavailable: "Nedostupno",
    illustration: "Animirana ilustracija",
    illustration_theme: "Tema ilustracije",
    theme_auto: "Automatski (sunce ili tamna tema)",
    theme_day: "Dan",
    theme_night: "Noć",
  },
  ro: {
    backups: "Copii de rezervă",
    ok: "La zi",
    late: "Întârziată",
    failed: "Eșuată",
    running: "În curs",
    unknown: "Nicio copie",
    never: "Niciodată",
    all_ok: "Toate la zi",
    n_failed: "{n} eșuate",
    n_late: "{n} întârziate",
    n_running: "{n} în curs",
    failed_at: "Eșuată {when}",
    late_limit: "Mai veche de {limit}",
    last_at: "Ultima {when}",
    next: "Următoarea {when}",
    run_backup: "Copiază acum",
    no_data: "Nimic de afișat: nu s-a găsit nicio copie de rezervă.",
    backups_field: "Copii (senzorii lor de ultimă copie; gol: automat)",
    max_age: "Vechime maximă",
    max_age_helper: "În ore: o copie mai veche este întârziată (implicit 26)",
    show_stats: "Afișează rezumatul",
    show_size: "Afișează dimensiunile",
    show_next: "Afișează următoarele copii",
    show_run: "Afișează butoanele Copiază acum",
    back_up: "Salvează",
    since_good: "de la ultima copie reușită",
    src_failed: "{name} a eșuat {when}",
    src_late: "{name} mai veche de {limit}",
    cancel: "Anulează",
    left: "Mai sunt {time}",
    today_at: "azi {time}",
    tomorrow_at: "mâine {time}",
    yesterday_at: "ieri {time}",
    zoom_in: "Arată detalii",
    zoom_out: "Arată mai puțin",
    title: "Titlu (opțional)",
    language: "Limbă",
    lang_auto: "Automat",
    collapsed: "Secțiuni pliate implicit",
    zoom: "Buton de detalii",
    zoom_helper: "Comută mini cardul la conținutul cardului complet",
    show_title: "Afișează titlul",
    show_subtitle: "Afișează subtitlul",
    no_registry: "Acest card necesită Home Assistant 2024.8 sau mai nou.",
    unavailable: "Indisponibil",
    illustration: "Ilustrație animată",
    illustration_theme: "Tema ilustrației",
    theme_auto: "Automat (soare sau temă întunecată)",
    theme_day: "Zi",
    theme_night: "Noapte",
  },
  da: {
    backups: "Sikkerhedskopier",
    ok: "Opdateret",
    late: "Forsinket",
    failed: "Mislykket",
    running: "I gang",
    unknown: "Ingen kopi",
    never: "Aldrig",
    all_ok: "Alle opdaterede",
    n_failed: "{n} mislykkede",
    n_late: "{n} forsinkede",
    n_running: "{n} i gang",
    failed_at: "Mislykket {when}",
    late_limit: "Ældre end {limit}",
    last_at: "Seneste {when}",
    next: "Næste {when}",
    run_backup: "Tag kopi nu",
    no_data: "Intet at vise: ingen sikkerhedskopi fundet.",
    backups_field: "Sikkerhedskopier (deres sensorer for seneste kopi; tom: automatisk)",
    max_age: "Maksimal alder",
    max_age_helper: "I timer: en ældre kopi er forsinket (standard 26)",
    show_stats: "Vis oversigten",
    show_size: "Vis størrelserne",
    show_next: "Vis de næste kopier",
    show_run: "Vis knapperne Tag kopi nu",
    back_up: "Sikkerhedskopiér",
    since_good: "siden den sidste vellykkede backup",
    src_failed: "{name} mislykkedes {when}",
    src_late: "{name} ældre end {limit}",
    cancel: "Annuller",
    left: "{time} tilbage",
    today_at: "i dag {time}",
    tomorrow_at: "i morgen {time}",
    yesterday_at: "i går {time}",
    zoom_in: "Vis detaljer",
    zoom_out: "Vis mindre",
    title: "Titel (valgfri)",
    language: "Sprog",
    lang_auto: "Automatisk",
    collapsed: "Sektioner foldet sammen som standard",
    zoom: "Detaljeknap",
    zoom_helper: "Skifter minikortet til det fulde korts indhold",
    show_title: "Vis titel",
    show_subtitle: "Vis undertitel",
    no_registry: "Dette kort kræver Home Assistant 2024.8 eller nyere.",
    unavailable: "Utilgængelig",
    illustration: "Animeret illustration",
    illustration_theme: "Illustrationens tema",
    theme_auto: "Automatisk (sol eller mørkt tema)",
    theme_day: "Dag",
    theme_night: "Nat",
  },
  sv: {
    backups: "Säkerhetskopior",
    ok: "Aktuell",
    late: "Försenad",
    failed: "Misslyckad",
    running: "Pågår",
    unknown: "Ingen kopia",
    never: "Aldrig",
    all_ok: "Alla aktuella",
    n_failed: "{n} misslyckade",
    n_late: "{n} försenade",
    n_running: "{n} pågår",
    failed_at: "Misslyckad {when}",
    late_limit: "Äldre än {limit}",
    last_at: "Senaste {when}",
    next: "Nästa {when}",
    run_backup: "Säkerhetskopiera nu",
    no_data: "Inget att visa: ingen säkerhetskopia hittades.",
    backups_field: "Säkerhetskopior (deras sensorer för senaste kopia; tomt: automatiskt)",
    max_age: "Maximal ålder",
    max_age_helper: "I timmar: en äldre kopia är försenad (standard 26)",
    show_stats: "Visa sammanfattningen",
    show_size: "Visa storlekarna",
    show_next: "Visa nästa kopior",
    show_run: "Visa knapparna Säkerhetskopiera nu",
    back_up: "Säkerhetskopiera",
    since_good: "sedan den senaste lyckade säkerhetskopian",
    src_failed: "{name} misslyckades {when}",
    src_late: "{name} äldre än {limit}",
    cancel: "Avbryt",
    left: "{time} kvar",
    today_at: "i dag {time}",
    tomorrow_at: "i morgon {time}",
    yesterday_at: "i går {time}",
    zoom_in: "Visa detaljer",
    zoom_out: "Visa mindre",
    title: "Titel (valfri)",
    language: "Språk",
    lang_auto: "Automatiskt",
    collapsed: "Sektioner hopfällda som standard",
    zoom: "Detaljknapp",
    zoom_helper: "Växlar minikortet till hela kortets innehåll",
    show_title: "Visa titel",
    show_subtitle: "Visa undertitel",
    no_registry: "Det här kortet kräver Home Assistant 2024.8 eller senare.",
    unavailable: "Otillgänglig",
    illustration: "Animerad illustration",
    illustration_theme: "Illustrationens tema",
    theme_auto: "Automatiskt (sol eller mörkt tema)",
    theme_day: "Dag",
    theme_night: "Natt",
  },
  bg: {
    backups: "Резервни копия",
    ok: "Актуално",
    late: "Закъсняло",
    failed: "Неуспешно",
    running: "В ход",
    unknown: "Няма копие",
    never: "Никога",
    all_ok: "Всички актуални",
    n_failed: "Неуспешни: {n}",
    n_late: "Закъснели: {n}",
    n_running: "В ход: {n}",
    failed_at: "Неуспешно {when}",
    late_limit: "По-старо от {limit}",
    last_at: "Последно {when}",
    next: "Следващо {when}",
    run_backup: "Създай копие сега",
    no_data: "Няма какво да се покаже: не е намерено резервно копие.",
    backups_field: "Копия (техните сензори за последно копие; празно: автоматично)",
    max_age: "Максимална възраст",
    max_age_helper: "В часове: по-старо копие е закъсняло (по подразбиране 26)",
    show_stats: "Показване на обобщението",
    show_size: "Показване на размерите",
    show_next: "Показване на следващите копия",
    show_run: "Показване на бутоните Създай копие сега",
    back_up: "Архивирай",
    since_good: "от последното успешно копие",
    src_failed: "{name} неуспешно {when}",
    src_late: "{name} по-старо от {limit}",
    cancel: "Отказ",
    left: "Остават {time}",
    today_at: "днес {time}",
    tomorrow_at: "утре {time}",
    yesterday_at: "вчера {time}",
    zoom_in: "Покажи подробности",
    zoom_out: "Покажи по-малко",
    title: "Заглавие (по избор)",
    language: "Език",
    lang_auto: "Автоматично",
    collapsed: "Сгънати по подразбиране раздели",
    zoom: "Бутон за подробности",
    zoom_helper: "Превключва мини картата към съдържанието на пълната карта",
    show_title: "Покажи заглавие",
    show_subtitle: "Покажи подзаглавие",
    no_registry: "Тази карта изисква Home Assistant 2024.8 или по-нов.",
    unavailable: "Недостъпно",
    illustration: "Анимирана илюстрация",
    illustration_theme: "Тема на илюстрацията",
    theme_auto: "Автоматично (слънце или тъмна тема)",
    theme_day: "Ден",
    theme_night: "Нощ",
  },
  ru: {
    backups: "Резервные копии",
    ok: "Актуальна",
    late: "Просрочена",
    failed: "Ошибка",
    running: "Выполняется",
    unknown: "Нет копии",
    never: "Никогда",
    all_ok: "Все актуальны",
    n_failed: "С ошибкой: {n}",
    n_late: "Просрочено: {n}",
    n_running: "Выполняется: {n}",
    failed_at: "Ошибка {when}",
    late_limit: "Старше {limit}",
    last_at: "Последняя {when}",
    next: "Следующая {when}",
    run_backup: "Создать копию сейчас",
    no_data: "Нечего показать: резервные копии не найдены.",
    backups_field: "Копии (их датчики последней копии; пусто: автоматически)",
    max_age: "Максимальный возраст",
    max_age_helper: "В часах: более старая копия просрочена (по умолчанию 26)",
    show_stats: "Показывать сводку",
    show_size: "Показывать размеры",
    show_next: "Показывать следующие копии",
    show_run: "Показывать кнопки «Создать копию сейчас»",
    back_up: "Создать копию",
    since_good: "с последней успешной копии",
    src_failed: "{name}: ошибка {when}",
    src_late: "{name} старше {limit}",
    cancel: "Отмена",
    left: "Осталось {time}",
    today_at: "сегодня {time}",
    tomorrow_at: "завтра {time}",
    yesterday_at: "вчера {time}",
    zoom_in: "Показать подробности",
    zoom_out: "Свернуть",
    title: "Заголовок (необязательно)",
    language: "Язык",
    lang_auto: "Автоматически",
    collapsed: "Свёрнутые по умолчанию разделы",
    zoom: "Кнопка подробностей",
    zoom_helper: "Переключает мини-карточку на содержимое полной карточки",
    show_title: "Показывать заголовок",
    show_subtitle: "Показывать подзаголовок",
    no_registry: "Для этой карточки нужен Home Assistant 2024.8 или новее.",
    unavailable: "Недоступно",
    illustration: "Анимированная иллюстрация",
    illustration_theme: "Тема иллюстрации",
    theme_auto: "Автоматически (солнце или тёмная тема)",
    theme_day: "День",
    theme_night: "Ночь",
  },
  uk: {
    backups: "Резервні копії",
    ok: "Актуальна",
    late: "Прострочена",
    failed: "Помилка",
    running: "Виконується",
    unknown: "Немає копії",
    never: "Ніколи",
    all_ok: "Усі актуальні",
    n_failed: "З помилкою: {n}",
    n_late: "Прострочено: {n}",
    n_running: "Виконується: {n}",
    failed_at: "Помилка {when}",
    late_limit: "Старша за {limit}",
    last_at: "Остання {when}",
    next: "Наступна {when}",
    run_backup: "Створити копію зараз",
    no_data: "Нічого показати: резервні копії не знайдено.",
    backups_field: "Копії (їхні датчики останньої копії; порожньо: автоматично)",
    max_age: "Максимальний вік",
    max_age_helper: "У годинах: старіша копія прострочена (типово 26)",
    show_stats: "Показувати підсумок",
    show_size: "Показувати розміри",
    show_next: "Показувати наступні копії",
    show_run: "Показувати кнопки «Створити копію зараз»",
    back_up: "Створити копію",
    since_good: "з останньої успішної копії",
    src_failed: "{name}: помилка {when}",
    src_late: "{name} старша за {limit}",
    cancel: "Скасувати",
    left: "Залишилось {time}",
    today_at: "сьогодні {time}",
    tomorrow_at: "завтра {time}",
    yesterday_at: "учора {time}",
    zoom_in: "Показати подробиці",
    zoom_out: "Згорнути",
    title: "Заголовок (необов'язково)",
    language: "Мова",
    lang_auto: "Автоматично",
    collapsed: "Згорнуті за замовчуванням розділи",
    zoom: "Кнопка подробиць",
    zoom_helper: "Перемикає міні-картку на вміст повної картки",
    show_title: "Показувати заголовок",
    show_subtitle: "Показувати підзаголовок",
    no_registry: "Для цієї картки потрібен Home Assistant 2024.8 або новіший.",
    unavailable: "Недоступно",
    illustration: "Анімована ілюстрація",
    illustration_theme: "Тема ілюстрації",
    theme_auto: "Автоматично (сонце або темна тема)",
    theme_day: "День",
    theme_night: "Ніч",
  },
  hu: {
    backups: "Biztonsági mentések",
    ok: "Naprakész",
    late: "Késésben",
    failed: "Sikertelen",
    running: "Folyamatban",
    unknown: "Nincs mentés",
    never: "Soha",
    all_ok: "Mind naprakész",
    n_failed: "{n} sikertelen",
    n_late: "{n} késésben",
    n_running: "{n} folyamatban",
    failed_at: "Sikertelen {when}",
    late_limit: "Régebbi, mint {limit}",
    last_at: "Utolsó {when}",
    next: "Következő {when}",
    run_backup: "Mentés most",
    no_data: "Nincs mit megjeleníteni: nem található biztonsági mentés.",
    backups_field: "Mentések (utolsó mentés érzékelőik; üres: automatikus)",
    max_age: "Legnagyobb kor",
    max_age_helper: "Órában: a régebbi mentés késésben van (alapértelmezés 26)",
    show_stats: "Összegzés megjelenítése",
    show_size: "Méretek megjelenítése",
    show_next: "Következő mentések megjelenítése",
    show_run: "Mentés most gombok megjelenítése",
    back_up: "Mentés",
    since_good: "az utolsó sikeres mentés óta",
    src_failed: "{name} sikertelen {when}",
    src_late: "{name} régebbi, mint {limit}",
    cancel: "Mégse",
    left: "Még {time}",
    today_at: "ma {time}",
    tomorrow_at: "holnap {time}",
    yesterday_at: "tegnap {time}",
    zoom_in: "Részletek",
    zoom_out: "Kevesebb",
    title: "Cím (nem kötelező)",
    language: "Nyelv",
    lang_auto: "Automatikus",
    collapsed: "Alapértelmezetten összecsukott szakaszok",
    zoom: "Részletek gomb",
    zoom_helper: "A minikártyát a teljes kártya tartalmára váltja",
    show_title: "Cím megjelenítése",
    show_subtitle: "Alcím megjelenítése",
    no_registry: "Ehhez a kártyához Home Assistant 2024.8 vagy újabb szükséges.",
    unavailable: "Nem elérhető",
    illustration: "Animált illusztráció",
    illustration_theme: "Az illusztráció témája",
    theme_auto: "Automatikus (nap vagy sötét téma)",
    theme_day: "Nappal",
    theme_night: "Éjszaka",
  },
  sk: {
    backups: "Zálohy",
    ok: "Aktuálna",
    late: "Oneskorená",
    failed: "Zlyhala",
    running: "Prebieha",
    unknown: "Žiadna záloha",
    never: "Nikdy",
    all_ok: "Všetky aktuálne",
    n_failed: "Zlyhané: {n}",
    n_late: "Oneskorené: {n}",
    n_running: "Prebieha: {n}",
    failed_at: "Zlyhala {when}",
    late_limit: "Staršia ako {limit}",
    last_at: "Posledná {when}",
    next: "Ďalšia {when}",
    run_backup: "Zálohovať teraz",
    no_data: "Nie je čo zobraziť: nenašla sa žiadna záloha.",
    backups_field: "Zálohy (ich senzory poslednej zálohy; prázdne: automaticky)",
    max_age: "Maximálny vek",
    max_age_helper: "V hodinách: staršia záloha je oneskorená (predvolene 26)",
    show_stats: "Zobraziť súhrn",
    show_size: "Zobraziť veľkosti",
    show_next: "Zobraziť ďalšie zálohy",
    show_run: "Zobraziť tlačidlá Zálohovať teraz",
    back_up: "Zálohovať",
    since_good: "od poslednej úspešnej zálohy",
    src_failed: "{name} zlyhala {when}",
    src_late: "{name} staršia ako {limit}",
    cancel: "Zrušiť",
    left: "Zostáva {time}",
    today_at: "dnes {time}",
    tomorrow_at: "zajtra {time}",
    yesterday_at: "včera {time}",
    zoom_in: "Zobraziť podrobnosti",
    zoom_out: "Zobraziť menej",
    title: "Názov (voliteľné)",
    language: "Jazyk",
    lang_auto: "Automaticky",
    collapsed: "Predvolene zbalené sekcie",
    zoom: "Tlačidlo podrobností",
    zoom_helper: "Prepne mini kartu na obsah úplnej karty",
    show_title: "Zobraziť názov",
    show_subtitle: "Zobraziť podnadpis",
    no_registry: "Táto karta vyžaduje Home Assistant 2024.8 alebo novší.",
    unavailable: "Nedostupné",
    illustration: "Animovaná ilustrácia",
    illustration_theme: "Téma ilustrácie",
    theme_auto: "Automaticky (slnko alebo tmavá téma)",
    theme_day: "Deň",
    theme_night: "Noc",
  },
  cs: {
    backups: "Zálohy",
    ok: "Aktuální",
    late: "Opožděná",
    failed: "Selhala",
    running: "Probíhá",
    unknown: "Žádná záloha",
    never: "Nikdy",
    all_ok: "Všechny aktuální",
    n_failed: "Selhalo: {n}",
    n_late: "Opožděné: {n}",
    n_running: "Probíhá: {n}",
    failed_at: "Selhala {when}",
    late_limit: "Starší než {limit}",
    last_at: "Poslední {when}",
    next: "Další {when}",
    run_backup: "Zálohovat nyní",
    no_data: "Není co zobrazit: nebyla nalezena žádná záloha.",
    backups_field: "Zálohy (jejich senzory poslední zálohy; prázdné: automaticky)",
    max_age: "Maximální stáří",
    max_age_helper: "V hodinách: starší záloha je opožděná (výchozí 26)",
    show_stats: "Zobrazit souhrn",
    show_size: "Zobrazit velikosti",
    show_next: "Zobrazit další zálohy",
    show_run: "Zobrazit tlačítka Zálohovat nyní",
    back_up: "Zálohovat",
    since_good: "od poslední úspěšné zálohy",
    src_failed: "{name} selhala {when}",
    src_late: "{name} starší než {limit}",
    cancel: "Zrušit",
    left: "Zbývá {time}",
    today_at: "dnes {time}",
    tomorrow_at: "zítra {time}",
    yesterday_at: "včera {time}",
    zoom_in: "Zobrazit podrobnosti",
    zoom_out: "Zobrazit méně",
    title: "Název (volitelné)",
    language: "Jazyk",
    lang_auto: "Automaticky",
    collapsed: "Ve výchozím stavu sbalené sekce",
    zoom: "Tlačítko podrobností",
    zoom_helper: "Přepne mini kartu na obsah plné karty",
    show_title: "Zobrazit název",
    show_subtitle: "Zobrazit podtitul",
    no_registry: "Tato karta vyžaduje Home Assistant 2024.8 nebo novější.",
    unavailable: "Nedostupné",
    illustration: "Animovaná ilustrace",
    illustration_theme: "Motiv ilustrace",
    theme_auto: "Automaticky (slunce nebo tmavý motiv)",
    theme_day: "Den",
    theme_night: "Noc",
  },
  sl: {
    backups: "Varnostne kopije",
    ok: "Posodobljena",
    late: "Zamuja",
    failed: "Neuspešna",
    running: "V teku",
    unknown: "Ni kopije",
    never: "Nikoli",
    all_ok: "Vse posodobljene",
    n_failed: "Neuspešne: {n}",
    n_late: "Zamujajo: {n}",
    n_running: "V teku: {n}",
    failed_at: "Neuspešna {when}",
    late_limit: "Starejša od {limit}",
    last_at: "Zadnja {when}",
    next: "Naslednja {when}",
    run_backup: "Varnostno kopiraj zdaj",
    no_data: "Ni kaj prikazati: ni najdene varnostne kopije.",
    backups_field: "Kopije (njihovi senzorji zadnje kopije; prazno: samodejno)",
    max_age: "Največja starost",
    max_age_helper: "V urah: starejša kopija zamuja (privzeto 26)",
    show_stats: "Prikaži povzetek",
    show_size: "Prikaži velikosti",
    show_next: "Prikaži naslednje kopije",
    show_run: "Prikaži gumbe Varnostno kopiraj zdaj",
    back_up: "Varnostno kopiraj",
    since_good: "od zadnje uspešne varnostne kopije",
    src_failed: "{name} ni uspela {when}",
    src_late: "{name} starejša od {limit}",
    cancel: "Prekliči",
    left: "Še {time}",
    today_at: "danes {time}",
    tomorrow_at: "jutri {time}",
    yesterday_at: "včeraj {time}",
    zoom_in: "Prikaži podrobnosti",
    zoom_out: "Prikaži manj",
    title: "Naslov (neobvezno)",
    language: "Jezik",
    lang_auto: "Samodejno",
    collapsed: "Privzeto strnjeni razdelki",
    zoom: "Gumb za podrobnosti",
    zoom_helper: "Preklopi mini kartico na vsebino polne kartice",
    show_title: "Prikaži naslov",
    show_subtitle: "Prikaži podnaslov",
    no_registry: "Ta kartica potrebuje Home Assistant 2024.8 ali novejši.",
    unavailable: "Ni na voljo",
    illustration: "Animirana ilustracija",
    illustration_theme: "Tema ilustracije",
    theme_auto: "Samodejno (sonce ali temna tema)",
    theme_day: "Dan",
    theme_night: "Noč",
  },
  lv: {
    backups: "Rezerves kopijas",
    ok: "Aktuāla",
    late: "Kavējas",
    failed: "Neizdevās",
    running: "Notiek",
    unknown: "Nav kopijas",
    never: "Nekad",
    all_ok: "Visas aktuālas",
    n_failed: "Neizdevās: {n}",
    n_late: "Kavējas: {n}",
    n_running: "Notiek: {n}",
    failed_at: "Neizdevās {when}",
    late_limit: "Vecāka par {limit}",
    last_at: "Pēdējā {when}",
    next: "Nākamā {when}",
    run_backup: "Dublēt tagad",
    no_data: "Nav ko rādīt: nav atrasta neviena rezerves kopija.",
    backups_field: "Kopijas (to pēdējās kopijas sensori; tukšs: automātiski)",
    max_age: "Maksimālais vecums",
    max_age_helper: "Stundās: vecāka kopija kavējas (pēc noklusējuma 26)",
    show_stats: "Rādīt kopsavilkumu",
    show_size: "Rādīt izmērus",
    show_next: "Rādīt nākamās kopijas",
    show_run: "Rādīt pogas Dublēt tagad",
    back_up: "Dublēt",
    since_good: "kopš pēdējās veiksmīgās dublēšanas",
    src_failed: "{name} neizdevās {when}",
    src_late: "{name} vecāka par {limit}",
    cancel: "Atcelt",
    left: "Atlikušas {time}",
    today_at: "šodien {time}",
    tomorrow_at: "rīt {time}",
    yesterday_at: "vakar {time}",
    zoom_in: "Rādīt detaļas",
    zoom_out: "Rādīt mazāk",
    title: "Virsraksts (neobligāts)",
    language: "Valoda",
    lang_auto: "Automātiski",
    collapsed: "Pēc noklusējuma sakļautās sadaļas",
    zoom: "Detaļu poga",
    zoom_helper: "Pārslēdz mini kartīti uz pilnās kartītes saturu",
    show_title: "Rādīt virsrakstu",
    show_subtitle: "Rādīt apakšvirsrakstu",
    no_registry: "Šai kartītei nepieciešams Home Assistant 2024.8 vai jaunāks.",
    unavailable: "Nav pieejams",
    illustration: "Animēta ilustrācija",
    illustration_theme: "Ilustrācijas motīvs",
    theme_auto: "Automātiski (saule vai tumšā tēma)",
    theme_day: "Diena",
    theme_night: "Nakts",
  },
  el: {
    backups: "Αντίγραφα ασφαλείας",
    ok: "Ενημερωμένο",
    late: "Καθυστερεί",
    failed: "Απέτυχε",
    running: "Σε εξέλιξη",
    unknown: "Κανένα αντίγραφο",
    never: "Ποτέ",
    all_ok: "Όλα ενημερωμένα",
    n_failed: "Απέτυχαν: {n}",
    n_late: "Καθυστερούν: {n}",
    n_running: "Σε εξέλιξη: {n}",
    failed_at: "Απέτυχε {when}",
    late_limit: "Παλαιότερο από {limit}",
    last_at: "Τελευταίο {when}",
    next: "Επόμενο {when}",
    run_backup: "Αντίγραφο τώρα",
    no_data: "Τίποτα για εμφάνιση: δεν βρέθηκε αντίγραφο ασφαλείας.",
    backups_field: "Αντίγραφα (οι αισθητήρες τελευταίου αντιγράφου τους· κενό: αυτόματα)",
    max_age: "Μέγιστη ηλικία",
    max_age_helper: "Σε ώρες: ένα παλαιότερο αντίγραφο καθυστερεί (προεπιλογή 26)",
    show_stats: "Εμφάνιση της σύνοψης",
    show_size: "Εμφάνιση των μεγεθών",
    show_next: "Εμφάνιση των επόμενων αντιγράφων",
    show_run: "Εμφάνιση των κουμπιών Αντίγραφο τώρα",
    back_up: "Αντίγραφο",
    since_good: "από το τελευταίο επιτυχές αντίγραφο",
    src_failed: "{name}: αποτυχία {when}",
    src_late: "{name} παλαιότερο από {limit}",
    cancel: "Ακύρωση",
    left: "Απομένουν {time}",
    today_at: "σήμερα {time}",
    tomorrow_at: "αύριο {time}",
    yesterday_at: "χθες {time}",
    zoom_in: "Εμφάνιση λεπτομερειών",
    zoom_out: "Εμφάνιση λιγότερων",
    title: "Τίτλος (προαιρετικό)",
    language: "Γλώσσα",
    lang_auto: "Αυτόματα",
    collapsed: "Ενότητες συμπτυγμένες από προεπιλογή",
    zoom: "Κουμπί λεπτομερειών",
    zoom_helper: "Αλλάζει τη μίνι κάρτα στο περιεχόμενο της πλήρους κάρτας",
    show_title: "Εμφάνιση τίτλου",
    show_subtitle: "Εμφάνιση υπότιτλου",
    no_registry: "Αυτή η κάρτα απαιτεί Home Assistant 2024.8 ή νεότερο.",
    unavailable: "Μη διαθέσιμο",
    illustration: "Κινούμενη εικονογράφηση",
    illustration_theme: "Θέμα εικονογράφησης",
    theme_auto: "Αυτόματο (ήλιος ή σκούρο θέμα)",
    theme_day: "Ημέρα",
    theme_night: "Νύχτα",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_ICONS = {
  chevron_down: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  expand: "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z",
  collapse: "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z",
  alert: "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  minus: "M19,13H5V11H19V13Z",
  play: "M8,5.14V19.14L19,12.14L8,5.14Z",
  pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
  stop: "M18,18H6V6H18V18Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
};
const ICONS = { ...BASE_ICONS, ...CARD_ICONS };

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const lang = (hass, config) => {
  const l = config?.language || (hass && (hass.locale?.language || hass.language)) || "en";
  return STRINGS[l] ? l : STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};

// Locale for Intl: the card's language, or Home Assistant's full locale when it has the same base (pt-BR, de-CH).
// A bare "pt" (Home Assistant's code for European Portuguese) becomes "pt-PT", otherwise Intl formats it the Brazilian way.
const intlLocale = (hass, config) => {
  const l = lang(hass, config);
  const src = config?.language || (hass && (hass.locale?.language || hass.language)) || "";
  const out = src && src.split("-")[0] === l.split("-")[0] ? src : l;
  return out === "pt" ? "pt-PT" : out;
};

const t = (hass, config, key, vars = {}) =>
  String(STRINGS[lang(hass, config)][key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

const valid = (s) => !!s && !["unknown", "unavailable", ""].includes(s.state);


const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Attributes of an element that opens an entity's more-info (nothing without an entity).
const moreInfo = (id) => (id ? ` role="button" tabindex="0" data-entity="${esc(id)}"` : "");
const svgIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const domainOf = (id) => String(id || "").split(".")[0];
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const DAY_MS = 8.64e7;


// "8:12", "1:05:00": a countdown, rounded up to the second.
const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

// A time stamp (ISO string, sensor state or input_datetime "YYYY-MM-DD HH:MM:SS") in ms; null otherwise.
const parseTime = (v) => {
  if (v === null || v === undefined || v === "" || v === "unknown" || v === "unavailable") return null;
  if (typeof v === "number") return v > 1e11 ? v : v * 1000;
  const s = String(v);
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(" ", "T") : s);
  return Number.isFinite(ms) ? ms : null;
};

const startOfDay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const fmtTime = (hass, config, ms) =>
  new Intl.DateTimeFormat(intlLocale(hass, config), { hour: "numeric", minute: "2-digit" }).format(new Date(ms));

// "today 18:00", "tomorrow 06:00", "yesterday 21:00", "Tue 06:00", "Jun 24, 06:00".
const fmtWhen = (hass, config, ms) => {
  const day = Math.round((startOfDay(ms) - startOfDay(Date.now())) / DAY_MS);
  const time = fmtTime(hass, config, ms);
  if (day === 0) return t(hass, config, "today_at", { time });
  if (day === 1) return t(hass, config, "tomorrow_at", { time });
  if (day === -1) return t(hass, config, "yesterday_at", { time });
  const locale = intlLocale(hass, config);
  if (Math.abs(day) < 7) return `${new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(ms))} ${time}`;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
};


// A length of time in its largest unit: "45 min", "7 h", "3 d" (the unit names from Intl).
const fmtSpan = (hass, config, ms) => {
  const locale = intlLocale(hass, config);
  const unit = (n, u) => new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: "narrow" }).format(n);
  if (ms < 3.6e6) return unit(Math.max(0, Math.round(ms / 6e4)), "minute");
  if (ms < 2 * DAY_MS) return unit(Math.round(ms / 3.6e6), "hour");
  return unit(Math.round(ms / DAY_MS), "day");
};

// Registries: entries by device, names, areas.
const _byDevice = new WeakMap();
const byDevice = (hass) => {
  let map = _byDevice.get(hass.entities);
  if (map) return map;
  map = new Map();
  for (const e of Object.values(hass.entities || {})) {
    if (!e.device_id) continue;
    if (!map.has(e.device_id)) map.set(e.device_id, []);
    map.get(e.device_id).push(e);
  }
  _byDevice.set(hass.entities, map);
  return map;
};
const devName = (d) => d?.name_by_user || d?.name || "";
const nameOf = (hass, id, fallback) => fallback || hass.states[id]?.attributes?.friendly_name || id;
// What an entity is called, to recognise it: its id, translation key and names (registry and state), as snake_case.
const keyText = (e, hass) =>
  [e.entity_id, e.translation_key, e.name, hass.states[e.entity_id]?.attributes?.friendly_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
const deviceClass = (hass, id) => hass.states[id]?.attributes?.device_class;
// Name of an entity without its device's name in front ("Kitchen Pasta" on the device "Kitchen" → "Pasta").
const shortName = (hass, id) => {
  const name = nameOf(hass, id);
  const dev = devName(hass.devices?.[hass.entities?.[id]?.device_id]);
  return dev && name.startsWith(`${dev} `) && name.length > dev.length + 1 ? name.slice(dev.length + 1) : name;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BASE_STYLE = `
  :host { --bk-accent: #546e7a; --bk-ok: var(--success-color, #43a047); --bk-warn: var(--warning-color, #ffa600);
          --bk-crit: var(--error-color, #db4437); --bk-idle: var(--disabled-text-color, #9e9e9e); --bk-active: var(--info-color, #039be5);
          /* Text in a state color is mixed with the text color so that it reads at 4.5:1 at least. */
          --bk-accent-text: color-mix(in srgb, var(--bk-accent) 50%, var(--primary-text-color)); }
  ha-card { overflow: hidden; container: bk-card / inline-size; }
  /* Natural width in a parent that sizes to its content (inline-block, grid "auto" column), without a minimum. */
  :host { display: block; min-width: 0; --bk-natural-width: 380px; }
  :host::before { content: ""; display: grid; grid-template-columns: minmax(0, var(--bk-natural-width)); height: 0; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); }
  .clickable { cursor: pointer; }
  [role="button"]:focus-visible { outline: 2px solid var(--primary-color, var(--bk-accent)); outline-offset: 2px; border-radius: 4px; }
  .ok { --c: var(--bk-ok); } .warn { --c: var(--bk-warn); } .crit { --c: var(--bk-crit); } .idle { --c: var(--bk-idle); }
  .active { --c: var(--bk-active); } .accent { --c: var(--bk-accent); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--bk-ok)); flex: none; display: inline-block; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; white-space: nowrap;
          background: color-mix(in srgb, var(--c, var(--bk-ok)) 15%, transparent); color: color-mix(in srgb, var(--c, var(--bk-ok)) 50%, var(--primary-text-color));
          flex: 0 1 auto; min-width: 0; max-width: 50%; overflow: hidden; box-sizing: border-box; }
  .chip-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 0; }
  /* The chip sits right after the title, centred on it; the title ellipsises first and keeps 4 characters. Short of
     room, the chip drops under the subtitle, whole. */
  .header .zoom { align-self: flex-start; margin-top: 10px; }
  .header > .titles { container: bk-ctitles / inline-size; display: grid; grid-template-columns: minmax(0, 1fr); align-content: center; }
  .ctline { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .ctline .name { flex: 0 1 auto; min-width: 4ch; }
  .ctline .chip { flex: none; max-width: 100%; }
  @container bk-ctitles (max-width: 190px) {
    .ctline { display: contents; }
    .ctline .chip { grid-row: 3; justify-self: start; margin-top: 2px; }
  }
  .type-icon { position: relative; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none;
               --bk-tint: var(--c, var(--bk-accent)); background: color-mix(in srgb, var(--bk-tint) 16%, transparent); transition: background-color .3s ease; }
  .type-icon .icon { width: 24px; height: 24px; fill: color-mix(in srgb, var(--bk-tint) 60%, var(--primary-text-color)); transition: fill .3s ease; }
  .titles { flex: 1 1 0; min-width: 5ch; }
  :host([hide-title]) .titles > .name, :host([hide-title]) .titles > :is(.ctline, .tline) > .name, :host([hide-subtitle]) .titles > .sub { display: none; }
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .warning { padding: 16px; color: color-mix(in srgb, var(--bk-warn) 50%, var(--primary-text-color)); }
  /* Buttons as on the other cards: a smoked-glass background (never a filled color), the icon in the accent color. */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer; font: inherit; font-size: 13px;
         font-weight: 500; padding: 6px 12px; border-radius: 18px; background: var(--secondary-background-color, rgba(127,127,127,.12));
         color: var(--primary-text-color); min-width: 0; }
  .btn span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .btn:not(:disabled):hover { background: color-mix(in srgb, var(--bk-accent) 12%, var(--secondary-background-color, rgba(127,127,127,.12))); }
  .btn .icon { width: 18px; height: 18px; color: var(--bk-accent); }
  .btn.primary { background: color-mix(in srgb, var(--bk-accent) 16%, transparent); color: var(--bk-accent-text); }
  .btn.primary:not(:disabled):hover { background: color-mix(in srgb, var(--bk-accent) 24%, transparent); }
  .btn.active { background: color-mix(in srgb, var(--bk-active) 16%, transparent); color: color-mix(in srgb, var(--bk-active) 50%, var(--primary-text-color)); }
  .btn.active .icon { color: var(--bk-active); }
  .btn.round { width: 36px; height: 36px; padding: 0; border-radius: 50%; flex: none; }
  .btn:disabled { opacity: .45; cursor: default; }
  .btn:focus-visible { outline: 2px solid var(--primary-color, var(--bk-accent)); outline-offset: 2px; }
  .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: -4px -4px -4px 0; border-radius: 50%;
          display: grid; place-items: center; color: var(--secondary-text-color); }
  .zoom .icon { width: 16px; height: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--bk-idle) 16%, transparent); color: var(--primary-text-color); }
  .zoom:focus-visible { outline: 2px solid var(--primary-color, var(--bk-accent)); outline-offset: 1px; }
  .line { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); min-width: 0; }
  .line .icon { width: 16px; height: 16px; }
  .line span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line.ok, .line.warn, .line.crit, .line.active, .line.accent { color: color-mix(in srgb, var(--c) 50%, var(--primary-text-color)); }
  .line.ok .icon, .line.warn .icon, .line.crit .icon, .line.active .icon, .line.accent .icon { color: var(--c); }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .num { font-variant-numeric: tabular-nums; }
  .content { padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 12px; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;
                   letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 6px; }
  .section-title.toggle { cursor: pointer; user-select: none; }
  .section-title .icon { width: 16px; height: 16px; }
  .section-title span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .section-title .count { margin-left: 2px; text-transform: none; letter-spacing: 0; font-weight: 400; }
  .section-title.toggle[aria-expanded="false"] { margin-bottom: 0; }
  /* Folded: the chevron points right; unfolded: down. */
  .section-title .chevron { margin-left: auto; width: 16px; height: 16px; transition: transform .2s ease; }
  .section-title.toggle[aria-expanded="false"] .chevron { transform: rotate(-90deg); }
  .empty { font-size: 13px; color: var(--secondary-text-color); padding: 2px 0; }
  .ring-svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .ring-svg circle { fill: none; }
  .ring-svg .track { stroke: color-mix(in srgb, var(--c, var(--bk-accent)) 18%, transparent); }
  .ring-svg .prog { stroke: var(--c, var(--bk-accent)); stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
  /* Hero, as on the garden and tempo cards: a flat illustration on the left, a big value and a few colored lines on the right. */
  .hero { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .hero-art { flex: none; width: 120px; display: grid; place-items: center; }
  .hero-art svg { width: 100%; height: auto; display: block; }
  .hero-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .hero-kick { font-size: 12px; color: var(--secondary-text-color); }
  .big { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .big .icon { width: 24px; height: 24px; align-self: center; color: var(--c, var(--bk-accent)); }
  .big b { font-size: 30px; font-weight: 400; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .big span { font-size: 14px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hero .line { font-size: 12.5px; }
  /* Rows, as the watering zones: a round icon (grey at rest, tinted otherwise, a ring while it runs), name, colored state, a button. */
  .row { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .row-icon { position: relative; width: 40px; height: 40px; border-radius: 50%; flex: none; display: grid; place-items: center;
              --t: var(--c, var(--bk-idle)); background: color-mix(in srgb, var(--t) 18%, transparent); color: color-mix(in srgb, var(--t) 70%, var(--primary-text-color)); }
  .row-icon.idle { background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); color: var(--secondary-text-color); }
  .row-icon > .icon, .row-icon > ha-icon { width: 22px; height: 22px; --mdc-icon-size: 22px; }
  .row-icon .ring-svg { inset: -2px; width: 44px; height: 44px; }
  .badge { position: absolute; right: -3px; bottom: -3px; width: 17px; height: 17px; border-radius: 50%; display: grid; place-items: center;
           background: var(--b, var(--bk-ok)); color: #fff; box-shadow: 0 0 0 2px var(--ha-card-background, var(--card-background-color, #fff)); }
  .badge .icon { width: 11px; height: 11px; }
  .row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .row-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-state { font-size: 12.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-state.ok, .row-state.warn, .row-state.crit, .row-state.active, .row-state.accent { color: color-mix(in srgb, var(--c) 60%, var(--primary-text-color)); }
  .rows { display: flex; flex-direction: column; gap: 8px; }
  /* Tiles, as on room overview: grey, tinted with a border when they need a look; small badges below. */
  .tiles { display: grid; gap: 8px; grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr)); }
  .tile { min-width: 0; display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 10px; box-sizing: border-box;
          background: var(--secondary-background-color, rgba(127,127,127,.12)); border: 1px solid transparent; }
  .tile.tint { background: color-mix(in srgb, var(--c) 13%, var(--secondary-background-color, rgba(127,127,127,.12)));
               border-color: color-mix(in srgb, var(--c) 30%, transparent); }
  .tile-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .tile .row-icon { width: 30px; height: 30px; } .tile .row-icon > .icon { width: 18px; height: 18px; }
  .tile .row-state { font-size: 12px; }
  .badges { display: flex; gap: 4px; flex-wrap: wrap; }
  .pill { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; padding: 1px 7px; border-radius: 10px;
          color: color-mix(in srgb, var(--c, var(--bk-idle)) 60%, var(--primary-text-color)); background: color-mix(in srgb, var(--c, var(--bk-idle)) 14%, transparent); }
  .pill .icon { width: 14px; height: 14px; color: var(--c, var(--bk-idle)); }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
  @container bk-card (max-width: 230px) {
    .header { gap: 6px; }
  }
  @container bk-card (max-width: 200px) {
    .chip { padding: 4px; flex: none; }
    .chip-text { display: none; }
  }
`;

// Popup at the top of the card, over a backdrop: it stays in view on a long card.
const DIALOG_STYLE = `
  ha-card.dialog-open { position: relative; min-height: 220px; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: flex-start; justify-content: center;
              padding-top: 12px; box-sizing: border-box; z-index: 9; border-radius: inherit; }
  .modal { background: var(--card-background-color, #1c1c1c); color: var(--primary-text-color); width: min(92%, 340px); max-height: calc(100% - 24px);
           box-sizing: border-box; border-radius: 14px; padding: 16px; box-shadow: 0 8px 30px rgba(0,0,0,.4); display: flex; flex-direction: column; gap: 12px; }
  .modal .msg { font-size: 15px; font-weight: 500; line-height: 1.3; overflow-wrap: anywhere; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  .stepper { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .stepper .val { font-size: 28px; font-weight: 400; min-width: 4ch; text-align: center; }
  .stepper .val small { font-size: 14px; color: var(--secondary-text-color); margin-left: 2px; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .preset { font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 14px; cursor: pointer; color: var(--primary-text-color);
            background: transparent; border: 1px solid color-mix(in srgb, var(--primary-text-color) 16%, transparent); }
  .preset.on { border-color: color-mix(in srgb, var(--bk-accent) 60%, transparent); color: var(--bk-accent-text); font-weight: 500;
               background: color-mix(in srgb, var(--bk-accent) 10%, transparent); }
  .field { font: inherit; font-size: 15px; width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; color: var(--primary-text-color);
           background: transparent; border: 1px solid color-mix(in srgb, var(--primary-text-color) 20%, transparent); }
  .field:focus { outline: 2px solid var(--primary-color, var(--bk-accent)); outline-offset: -1px; }
`;

// The mini card: header and a compact row; its detail button switches it to the full card's content.
const MINI_STYLE = `
  :host { --bk-natural-width: 300px; }
  .content.mini { flex-direction: row; align-items: center; gap: 12px; }
  .mini .info { gap: 4px; }
  .mini .line .icon { width: 14px; height: 14px; }
  .controls { display: flex; gap: 6px; flex: none; }
  @container (max-width: 300px) {
    .content.mini { flex-wrap: wrap; row-gap: 8px; }
    .mini .controls { flex-basis: 100%; justify-content: flex-end; }
  }
`;

// Element names of Home Assistant dialogs (a more-info opened from the card): a click there is not "elsewhere".
const DIALOG_TAGS = new Set(["HA-MORE-INFO-DIALOG", "HA-DIALOG", "DIALOG"]);
const isOutside = (card, ev) => {
  const path = ev.composedPath();
  return !path.includes(card) && !path.some((n) => DIALOG_TAGS.has(n.tagName));
};

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app) a
// tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to the
// page. It counts when the press and the release are both outside the card (a slider dragged out of the card does not
// fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through the click
// event. `tap(ev)` (a press and a release at the same spot) is for the tests.
const watchOutside = (isOut, handler) => {
  let downOutside = false;
  const onDown = (ev) => {
    downOutside = isOut(ev);
  };
  const onUp = (ev) => {
    if (downOutside && isOut(ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && isOut(ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
  };
};
// After a popup closes, clicks on the card are ignored this long (the second click of a double click).
const CONFIRM_GUARD_MS = 400;
// Elements a click acts on, and how one is told from the others across renders (focus kept for keyboard users).
const FOCUS_SELECTOR = "[data-action], [data-entity], [data-keep]";
const focusKey = (el) => {
  const data = Object.entries({ ...el.dataset });
  return data.length ? `${el.tagName}|${JSON.stringify(data)}` : "";
};
// A progress ring (SVG, size × size, stroke width w) whose progress `p` (0..1) is drawn; `end` and `total` (ms) make it
// count down every second in place (see _syncCountdown).
const ring = (size, w, p, { end, total } = {}) => {
  const r = (size - w) / 2;
  const c = 2 * Math.PI * r;
  const live = end && total ? ` data-end="${end}" data-total="${total}" data-c="${c.toFixed(2)}"` : "";
  return `<svg class="ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${w}"/><circle class="prog" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${w}" stroke-dasharray="${c.toFixed(2)}" style="stroke-dashoffset:${(c * (1 - clamp(p, 0, 1))).toFixed(2)}"${live}/></svg>`;
};

// ---------------------------------------------------------------------------
// Card base
// ---------------------------------------------------------------------------

// What every card of this file shares: rendering only when something shown changed, no rewrite under a press, focus
// kept for keyboard users, folding sections, a popup at the top of the card, live countdowns, service calls.
// A card defines _build() (its model from the registries and the configuration), _entityIds(m), _render(), and may
// define _action(action, el, ev), _dialogHtml() / _dialogAction(action, el), _extraDeps(), _onConnect() / _onDisconnect().
class CardBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._inputs = {};
    // No rewrite of the card between a press and its click: Home Assistant updates the card several times a second,
    // and a rewrite under the pointer replaces the element pressed, so that the click lands on the card itself and
    // does nothing. The update held back is drawn once released: by the click (registered before the card's own
    // handler, which renders at once), else right after the release.
    this._onPress = () => {
      this._byPointer = true;
      this._pressing = true;
      window.addEventListener("pointerup", this._onPressEnd, true);
      window.addEventListener("pointercancel", this._onPressEnd, true);
    };
    this._onPressEnd = () => {
      window.removeEventListener("pointerup", this._onPressEnd, true);
      window.removeEventListener("pointercancel", this._onPressEnd, true);
      setTimeout(() => {
        this._pressing = false;
        if (this._dirty) this._update();
      }, 0);
    };
    this._onPressClick = (ev) => {
      if (ev.detail === 0) this._byPointer = false;
      this._pressing = false;
    };
    this.shadowRoot.addEventListener("pointerdown", this._onPress);
    this.shadowRoot.addEventListener("click", this._onPressClick);
    // From the keyboard, the focus is kept across rewrites (with the pointer it would draw the focus ring).
    this.shadowRoot.addEventListener("keydown", () => {
      this._byPointer = false;
    });
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    // Text typed in a field of the card is kept across rewrites (see _update); Enter in it acts as its button.
    this.shadowRoot.addEventListener("input", (ev) => {
      const key = ev.target?.dataset?.keep;
      if (key) this._inputs[key] = ev.target.value;
    });
    this.shadowRoot.addEventListener("keydown", (ev) => {
      const el = ev.target;
      if (ev.key === "Enter" && el?.dataset?.keep && el.dataset.submit) {
        ev.preventDefault();
        this._onClick({ composedPath: () => [{ dataset: { action: el.dataset.submit } }], stopPropagation() {}, detail: 0 });
        return;
      }
      // Enter / Space on an element with the button role acts as a click, as on a <button>.
      if ((ev.key !== "Enter" && ev.key !== " ") || el?.getAttribute?.("role") !== "button") return;
      ev.preventDefault();
      el.click();
    });
    this._onKey = (ev) => {
      if (ev.key !== "Escape" || !this._dialog) return;
      ev.stopPropagation();
      this._closeDialog();
    };
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this.toggleAttribute?.("hide-title", config.show_title === false);
    this.toggleAttribute?.("hide-subtitle", config.show_subtitle === false);
    this._html = "";
    this._lastDeps = null;
    this._model = null;
    this._configChanged?.();
    this._update();
  }

  // Home Assistant pushes a new hass on every state change of the whole instance: the card is only rebuilt when
  // something it shows changed (see _deps).
  set hass(hass) {
    this._hass = hass;
    const deps = this._deps();
    const prev = this._lastDeps;
    if (deps && prev && deps.length === prev.length && deps.every((d, i) => d === prev[i])) return;
    this._lastDeps = deps;
    this._update();
  }

  get hass() {
    return this._hass;
  }

  // The registries, the language, the theme, the state objects the card reads, its own data and the minute (the
  // "12 min ago" texts move on their own).
  _deps() {
    const h = this._hass;
    if (!h || !this._config) return null;
    const m = this._resolve();
    const ids = m ? this._entityIds(m) : [];
    return [h.entities, h.devices, h.areas, h.language, h.locale, h.themes?.darkMode, h.states?.["sun.sun"]?.state, Math.floor(Date.now() / 6e4), ...this._extraDeps(), ...ids.map((id) => h.states[id])];
  }

  _extraDeps() {
    return [];
  }

  // The model is rebuilt when the registries or the set of entities change (a new entity, a device renamed).
  _resolve() {
    const h = this._hass;
    if (!h?.entities || !h?.devices) return null;
    const key = [h.entities, h.devices, h.areas, Object.keys(h.states).length];
    if (this._model && this._modelKey?.every((k, i) => k === key[i])) return this._model;
    this._modelKey = key;
    this._model = this._build();
    return this._model;
  }

  connectedCallback() {
    // A click elsewhere on the page folds the sections back to their defaults and closes the popup.
    this._outside ??= watchOutside(
      (ev) => isOutside(this, ev),
      () => {
        if (!this._toggled?.size && !this._dialog) return;
        this._toggled = new Map();
        if (this._dialog) this._closeDialog();
        else this._update();
      },
    );
    this._outside.on();
    if (this._dialog) window.addEventListener("keydown", this._onKey);
    clearInterval(this._tick);
    this._tick = setInterval(() => {
      if (this._hass) this.hass = this._hass;
    }, 60000);
    this._onConnect?.();
    this._update();
  }

  disconnectedCallback() {
    this._pressing = this._dirty = false;
    window.removeEventListener("pointerup", this._onPressEnd, true);
    window.removeEventListener("pointercancel", this._onPressEnd, true);
    clearInterval(this._tick);
    clearInterval(this._countdown);
    this._tick = this._countdown = null;
    this._outside?.off();
    window.removeEventListener("keydown", this._onKey);
    this._onDisconnect?.();
    // Left (another dashboard view, a conditional card hidden): back to the defaults, so that the card does not come
    // back unfolded or with its popup open.
    this._toggled = new Map();
    this._dialog = null;
  }

  _t(key, vars) {
    return t(this._hass, this._config, key, vars);
  }

  _locale() {
    return intlLocale(this._hass, this._config);
  }

  _s(id) {
    return id ? this._hass.states[id] : undefined;
  }

  // Service call whose failure Home Assistant already reports (toast): handled here so that it does not end up as
  // "Uncaught (in promise)".
  _call(domain, service, data) {
    const r = this._hass.callService(domain, service, data);
    if (r && typeof r.catch === "function") r.catch(() => {});
    return r;
  }

  // A websocket command, through hass.callWS (or the connection), resolved with null on error.
  async _ws(msg) {
    const h = this._hass;
    try {
      if (h.callWS) return await h.callWS(msg);
      if (h.connection?.sendMessagePromise) return await h.connection.sendMessagePromise(msg);
    } catch {
      return null;
    }
    return null;
  }

  _update() {
    if (!this._hass || !this._config) return;
    // Held back under a press (see the constructor): drawn once released.
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    let html = this._render();
    if (this._dialog) {
      html = html.replace(/<ha-card(\s[^>]*)?>([\s\S]*)<\/ha-card>\s*$/, (_, attrs = "", inner) => {
        const a = attrs.includes('class="') ? attrs.replace('class="', 'class="dialog-open ') : `${attrs} class="dialog-open"`;
        return `<ha-card${a}>${inner}<style>${DIALOG_STYLE}</style>${this._dialogHtml()}</ha-card>`;
      });
    }
    if (html !== this._html) {
      const active = this.shadowRoot.activeElement;
      const field = active?.dataset?.keep ? { key: active.dataset.keep, start: active.selectionStart, end: active.selectionEnd } : null;
      const focused = this._dialog && active?.dataset?.action;
      const kept = this._dialog || this._byPointer ? null : this._focusedSpot();
      this._html = html;
      this.shadowRoot.innerHTML = html;
      // Fields get back what was typed, and the caret when one had the focus.
      for (const el of this.shadowRoot.querySelectorAll?.("[data-keep]") || []) {
        const v = this._inputs[el.dataset.keep];
        if (v !== undefined) el.value = v;
      }
      if (field) {
        const el = this.shadowRoot.querySelector(`[data-keep="${field.key}"]`);
        el?.focus?.({ preventScroll: true });
        el?.setSelectionRange?.(field.start, field.end);
      } else if (kept) this._restoreFocus(kept);
      if (this._dialog && !field) {
        const sel = focused ? `.modal [data-action="${focused}"]` : ".modal [data-keep], .modal .primary";
        this.shadowRoot.querySelector(sel)?.focus?.({ preventScroll: true });
      }
    }
    this._syncCountdown();
    this._afterUpdate?.();
  }

  // Countdowns move every second in place (no re-render, which would restart the animations): the text of [data-end]
  // elements, and the arc of rings (data-total and data-c). The card is redrawn once a countdown ends.
  _syncCountdown() {
    const els = [...(this.shadowRoot.querySelectorAll?.("[data-end]") || [])];
    if (!els.length) {
      clearInterval(this._countdown);
      this._countdown = null;
      return;
    }
    if (this._countdown) return;
    this._countdown = setInterval(() => {
      const now = Date.now();
      let ended = false;
      for (const el of this.shadowRoot.querySelectorAll("[data-end]")) {
        const left = Number(el.dataset.end) - now;
        if (left <= 0) ended = true;
        if (el.dataset.total) {
          const offset = (Number(el.dataset.c) * (1 - clamp(left / Number(el.dataset.total), 0, 1))).toFixed(2);
          if (el.style.strokeDashoffset !== offset) el.style.strokeDashoffset = offset;
        } else {
          const text = el.dataset.fmt === "left" ? this._t("left", { time: fmtCountdown(left) }) : fmtCountdown(left);
          if (el.textContent !== text) el.textContent = text;
        }
      }
      if (ended) {
        clearInterval(this._countdown);
        this._countdown = null;
        this._lastDeps = null;
        this._update();
      }
    }, 1000);
  }

  _focusedSpot() {
    const el = this.shadowRoot.activeElement;
    if (!el?.dataset) return null;
    const key = focusKey(el);
    if (!key) return null;
    const index = this._focusables(key).indexOf(el);
    return index < 0 ? null : { key, index };
  }

  _focusables(key) {
    return [...this.shadowRoot.querySelectorAll(FOCUS_SELECTOR)].filter((n) => focusKey(n) === key);
  }

  _restoreFocus({ key, index }) {
    this._focusables(key)[index]?.focus({ preventScroll: true });
  }

  _onClick(ev) {
    const path = ev.composedPath();
    const el = path.find((n) => n.dataset && (n.dataset.entity || n.dataset.action));
    if (!this._dialog && Date.now() - (this._dialogClosedAt ?? 0) < CONFIRM_GUARD_MS) {
      ev.stopPropagation();
      return;
    }
    if (this._dialog) {
      ev.stopPropagation();
      const action = el?.dataset.action;
      if (action === "dialog_cancel" || (action === "dialog_backdrop" && path[0] === el)) return this._closeDialog();
      if (action) this._dialogAction(action, el);
      return;
    }
    if (!el) return;
    ev.stopPropagation();
    const { action, entity } = el.dataset;
    if (action === "zoom") return this._toggleZoom(ev);
    if (action === "toggle_section") {
      const key = el.dataset.section;
      this._toggled = new Map(this._toggled).set(key, !this._isCollapsed(key));
      return this._update();
    }
    if (action && this._action(action, el, ev)) return;
    if (entity) this._moreInfo(entity);
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _action() {
    return false;
  }

  _dialogAction() {}

  _dialogHtml() {
    return "";
  }

  _openDialog(d) {
    this._dialog = d;
    window.addEventListener("keydown", this._onKey);
    this._update();
    this.shadowRoot.querySelector(".modal [data-keep], .modal .primary")?.focus?.();
  }

  _closeDialog() {
    this._dialog = null;
    this._dialogClosedAt = Date.now();
    window.removeEventListener("keydown", this._onKey);
    this._update();
  }

  // The popup's frame: a message, the content and its buttons (cancel, then the main action).
  _modal(title, body, okLabel, okIcon, okDisabled = false) {
    return `<div class="backdrop" data-action="dialog_backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="msg">${esc(title)}</div>
        ${body}
        <div class="modal-actions">
          <button class="btn" data-action="dialog_cancel"><span>${esc(this._t("cancel"))}</span></button>
          <button class="btn primary" data-action="dialog_ok"${okDisabled ? " disabled" : ""}>${okIcon ? svgIcon(okIcon) : ""}<span>${esc(okLabel)}</span></button>
        </div>
      </div>
    </div>`;
  }

  _isCollapsed(key) {
    if (this._toggled?.has(key)) return this._toggled.get(key);
    return asList(this._config.collapsed ?? this.constructor.defaultCollapsed ?? []).includes(key);
  }

  _sectionTitle(key, icon, label, count = "") {
    const closed = this._isCollapsed(key);
    return `<div class="section-title toggle" role="button" tabindex="0" data-action="toggle_section" data-section="${key}" aria-expanded="${!closed}">${svgIcon(icon)}<span>${esc(
      label,
    )}</span>${count !== "" ? `<span class="count">${esc(count)}</span>` : ""}${svgIcon(ICONS.chevron_down, "chevron")}</div>`;
  }

  // A folding section: its title, and its body unless folded.
  _section(key, icon, label, count, body) {
    return `<div class="section">${this._sectionTitle(key, icon, label, count)}${this._isCollapsed(key) ? "" : body}</div>`;
  }

  // The model ready to draw, or the error card to draw instead: no registries (Home Assistant too old), or nothing to
  // show (_emptyKey(m) names the message).
  _ready() {
    const m = this._resolve();
    if (!m) return { error: this._errorCard("no_registry") };
    const empty = this._emptyKey(m);
    return empty ? { error: this._errorCard(empty) } : { m };
  }

  _emptyKey() {
    return null;
  }

  _errorCard(key) {
    return `<style>${BASE_STYLE}</style><ha-card><div class="warning">${esc(this._t(key))}</div></ha-card>`;
  }

  // Header: the tinted round icon (its tint follows `cls`), the title and subtitle, the status chip on the title's line.
  _header({ icon, cls = "accent", title, sub, chip, extra = "" }) {
    return `
      <div class="header">
        <div class="type-icon ${cls}">${extra}${svgIcon(icon)}</div>
        <div class="titles">
          <div class="ctline"><div class="name">${esc(title)}</div>${
            chip
              ? `<span class="chip ${chip.cls}${chip.entity ? " clickable" : ""}"${moreInfo(chip.entity)} title="${esc(chip.text)}" aria-label="${esc(
                  chip.text,
                )}"><span class="dot"></span><span class="chip-text">${esc(chip.text)}</span></span>`
              : ""
          }</div>
          ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
        </div>
        ${this._zoomButton()}
      </div>`;
  }

  _zoomButton() {
    return "";
  }

  _toggleZoom() {}
}

// The mini card is the full card drawn compact: its detail button (top right, `zoom: false` removes it) switches it
// to the full card's content and back, and a click anywhere else on the page brings the compact view back.
const withMini = (Full) =>
  class extends Full {
    constructor() {
      super();
      this._unzoom = watchOutside(
        (ev) => isOutside(this, ev),
        () => {
          if (this._zoomed && !this._dialog) this._setZoom(false);
        },
      );
    }

    connectedCallback() {
      super.connectedCallback();
      this._unzoom.on();
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this._unzoom.off();
      // Back to the compact view once off the screen (see the full card).
      this._zoomed = false;
    }

    getCardSize() {
      return this._zoomed ? super.getCardSize() : 3;
    }

    getGridOptions() {
      return { ...(this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 }), rows: "auto" };
    }

    _zoomButton() {
      if (this._config.zoom === false) return "";
      const z = this._zoomed;
      const label = esc(this._t(z ? "zoom_out" : "zoom_in"));
      return `<button class="zoom" data-action="zoom" title="${label}" aria-label="${label}">${svgIcon(z ? ICONS.collapse : ICONS.expand)}</button>`;
    }

    _setZoom(on) {
      this._zoomed = on;
      this._update();
      this.dispatchEvent(new CustomEvent("iron-resize", { bubbles: true, composed: true }));
    }

    _toggleZoom(ev) {
      this._setZoom(!this._zoomed);
      if (ev.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
    }

    _render() {
      return this._zoomed ? super._render() : this._renderMini();
    }
  };

// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------

const LANGUAGES = [
  ["en", "English"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["es", "Español"],
  ["sr", "Српски"],
  ["sr-Latn", "Srpski (latinica)"],
  ["it", "Italiano"],
  ["nl", "Nederlands"],
  ["pt", "Português (Portugal)"],
  ["pl", "Polski"],
  ["ro", "Română"],
  ["da", "Dansk"],
  ["sv", "Svenska"],
  ["bg", "Български"],
  ["ru", "Русский"],
  ["uk", "Українська"],
  ["hu", "Magyar"],
  ["sk", "Slovenčina"],
  ["cs", "Čeština"],
  ["sl", "Slovenščina"],
  ["lv", "Latviešu"],
  ["el", "Ελληνικά"],
];

// An editor is a ha-form: `fields` (the card's options), `toggles` ([name, default] booleans), `defaults` (options
// left out of the YAML when at their default), `sections` (the foldable sections, for `collapsed`). Options written
// in YAML that the form does not show are kept.
class EditorBase extends HTMLElement {
  static get toggles() {
    return [];
  }

  static get defaults() {
    return {};
  }

  static get sections() {
    return [];
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _fields() {
    return [];
  }

  _schema() {
    const tr = (k) => t(this._hass, this._config, k);
    const toggles = this.constructor.toggles;
    const sections = this.constructor.sections;
    return [
      { name: "title", selector: { text: {} } },
      ...this._fields(),
      ...(toggles.length ? [{ type: "grid", name: "", schema: toggles.map(([name]) => ({ name, selector: { boolean: {} } })) }] : []),
      ...(sections.length ? [{ name: "collapsed", selector: { select: { multiple: true, mode: "list", options: sections.map((value) => ({ value, label: tr(value) })) } } }] : []),
      { name: "language", selector: { select: { mode: "dropdown", options: [{ value: "", label: tr("lang_auto") }, ...LANGUAGES.map(([value, label]) => ({ value, label }))] } } },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    const toggles = this.constructor.toggles;
    const defaults = { ...Object.fromEntries(toggles), ...this.constructor.defaults };
    if (!this._form) {
      this._form = document.createElement("ha-form");
      // A field's label is its `<name>_field` text when the card also uses `<name>` for something else (a section).
      this._form.computeLabel = (s) => t(this._hass, this._config, STRINGS.en[`${s.name}_field`] ? `${s.name}_field` : s.name);
      this._form.computeHelper = (s) => (STRINGS.en[`${s.name}_helper`] ? t(this._hass, this._config, `${s.name}_helper`) : undefined);
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        for (const [k, v] of Object.entries(config)) {
          // Keep the YAML minimal: no empty values, no options left at their default.
          if (v === "" || v === undefined || v === null || (Array.isArray(v) && !v.length) || (k in defaults && JSON.stringify(v) === JSON.stringify(defaults[k]))) delete config[k];
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    if (this._formConfig !== this._config) {
      this._formConfig = this._config;
      this._form.data = { ...defaults, ...this._config };
    }
    const l = lang(this._hass, this._config);
    if (this._schemaLang !== l) {
      this._schemaLang = l;
      this._form.schema = this._schema();
    }
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const define = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
};

const register = (cards, url) => {
  for (const [name, cls] of cards) define(name, cls);
  window.customCards = window.customCards || [];
  for (const [type, , card] of cards) {
    if (card && !window.customCards.some((c) => c.type === type)) window.customCards.push({ type, ...card, preview: true, documentationURL: url });
  }
};

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

// A size in bytes from a value and its unit (B to TB, KiB to TiB; a sensor of Home Assistant's backups is in MB).
const UNIT_BYTES = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };
const toBytes = (v, unit) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const m = /([kmgt]?i?b)\b/i.exec(unit || String(v));
  return n * (UNIT_BYTES[(m?.[1] || "b").toLowerCase()] ?? 1);
};

// The parts of a backup source among a list of registry entries: the time of the last good backup, of the last
// attempt and of the last failure, a status text, the next scheduled backup, the size, a "running" and a "failed"
// binary sensor, and the button that starts a backup.
// Buttons of other tasks than a backup (Backrest's prune, check, forget…).
const OTHER_TASK = /prune|check|forget|refresh|unlock|stats|purge|restore|cancel/;
const NOT_LAST = /attempt|fail|size|duration|result|status|next|count|number|free|speed/;
const slug = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
// What an entity is called without its device's name: its object id less the device's slug in front, its translation
// key and its short name. A node or a guest named "pve-backup" is not a backup entity.
const ownText = (e, hass) => {
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
const findParts = (hass, list, strict = false) => {
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
const lc = (s) => String(s?.state ?? "").toLowerCase();
const ADDONS = {
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
const addonOf = (s) => (s?.entity_id?.startsWith("sensor.") ? Object.keys(ADDONS).find((k) => ADDONS[k].test(s.attributes || {})) || null : null);

const _cache = new WeakMap();

// A source: { key, platform, name, sub, parts (entity ids), drive (entity id of an add-on's sensor), maxAge (ms),
// button, run }.
const source = (hass, platform, list, extra = {}) => {
  const p = PLATFORMS[platform];
  const parts = findParts(hass, list, platform === "proxmoxve");
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
const resolve = (hass, config) => {
  let per = _cache.get(hass.entities);
  if (!per) _cache.set(hass.entities, (per = new Map()));
  // Home Assistant's own last backup is in the key: Auto Backup is listed only until it has one.
  const own = Object.values(hass.entities || {}).find((e) => e.platform === "backup" && /last_successful/.test(e.translation_key || e.entity_id));
  const sig = `${JSON.stringify(config.backups)}|${Object.keys(hass.states).length}|${parseTime(hass.states[own?.entity_id]?.state) !== null}`;
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
const RUNNING_TEXT = /running|in_progress|create_backup|backing_up|started|active/;
const FAILED_TEXT = /error|fail|fault/;
const sourceState = (hass, src, { now = Date.now(), maxAge = MAX_AGE_H * 3.6e6, started = 0 } = {}) => {
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

// Bytes in the largest unit that fits: "1.4 GB", "820 MB" (unit names from Intl).
const fmtSize = (bytes, locale) => {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"];
  let i = 0;
  let v = bytes;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: units[i], unitDisplay: "short", maximumFractionDigits: v < 10 && i ? 1 : 0 }).format(v);
};

const RANK = { failed: 0, late: 1, unknown: 2, running: 3, ok: 4 };
const CLS = { failed: "crit", late: "warn", unknown: "idle", running: "active", ok: "ok" };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// The illustration of the hero: servers sending to a cloud, with a badge of the worst status. Colors come from the
// theme so that it reads in light and dark modes; while a backup runs, the arrow into the cloud moves.
const art = (status, running = status === "running") => {
  const badge = {
    failed: '<circle cx="100" cy="82" r="11" fill="var(--bk-crit)"/><path d="M100 76 v7 M100 87 v.5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    late: '<circle cx="100" cy="82" r="11" fill="var(--bk-warn)"/><path d="M100 76 v7 M100 87 v.5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    ok: '<circle cx="100" cy="82" r="11" fill="var(--bk-ok)"/><path d="M95 82 l3.5 3.5 l6.5 -7" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    running: '<circle cx="100" cy="82" r="11" fill="var(--bk-active)"/><path d="M100 76 a6 6 0 1 1 -6 6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  }[status] || "";
  const leds = [0, 1, 2].map((i) => `<rect x="14" y="${54 + i * 12}" width="36" height="10" rx="2" fill="var(--bk-rack)"/><circle cx="20" cy="${59 + i * 12}" r="1.8" fill="${status === "failed" && i === 2 ? "var(--bk-crit)" : "var(--bk-ok)"}"/><rect x="26" y="${57.5 + i * 12}" width="18" height="3" rx="1.5" fill="var(--bk-slot)"/>`).join("");
  return `<svg viewBox="0 0 120 100" aria-hidden="true">
    <path d="M40 40 a18 18 0 0 1 34 -6 a14 14 0 0 1 22 12 a12 12 0 0 1 -2 24 h-50 a15 15 0 0 1 -4 -30 z" fill="var(--bk-cloud)" stroke="var(--bk-cloud-line)" stroke-width="2"/>
    <g class="arrow${running ? " moving" : ""}"><path d="M66 44 v16 m-6 -6 l6 6 l6 -6" stroke="var(--bk-active)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${leds}${badge}</svg>`;
};

const BACKUP_STYLE = `
  :host { --bk-rack: #78909c; --bk-slot: #b0bec5; --bk-cloud: color-mix(in srgb, var(--bk-active) 12%, transparent);
          --bk-cloud-line: color-mix(in srgb, var(--bk-active) 45%, transparent); }
  /* A backup running: the arrow goes into the cloud, an arc turns round the source, the button's icon turns. */
  .arrow.moving { animation: bk-drop 1.2s ease-in-out infinite; }
  @keyframes bk-drop { 0% { transform: translateY(-6px); opacity: 0; } 30%, 70% { opacity: 1; } 100% { transform: translateY(6px); opacity: 0; } }
  .spin { position: absolute; inset: -2px; border-radius: 50%; border: 3px solid color-mix(in srgb, var(--c, var(--bk-accent)) 18%, transparent);
          border-top-color: var(--c, var(--bk-accent)); animation: bk-spin 1.2s linear infinite; }
  @keyframes bk-spin { to { transform: rotate(360deg); } }
  .btn .icon.turn { animation: bk-spin 1.2s linear infinite; }
  .row-name small { font-size: 12px; font-weight: 400; color: var(--secondary-text-color); margin-left: 6px; }
  .row .btn { flex: none; }
  .mini-art { flex: none; width: 84px; }
  .mini-art svg { width: 84px; height: auto; display: block; }
  .mini .line .num { flex: none; margin-left: auto; }
  @container (max-width: 300px) {
    .hero-art { width: 64px; }
    .big { flex-wrap: wrap; row-gap: 2px; }
    .big b { font-size: 24px; }
    .big span { white-space: normal; flex-basis: 100%; }
    .row { gap: 8px; }
    .row .btn span { display: none; }
    .row .btn { width: 36px; height: 36px; padding: 0; border-radius: 50%; }
  }
  @container (max-width: 200px) {
    .hero-art, .mini-art { display: none; }
  }
`;

// ---------------------------------------------------------------------------
// Illustrated header
// ---------------------------------------------------------------------------

// The banner: the title on the left, over the wall of a server room; on the right (a 200 × 80 picture drawn to the
// right edge, its empty left part cropped on a narrow card) the home server and its backup disk standing on the
// floor, a link up to a cloud seen through the window. Its state is the worst one: up to date (a green check on the
// cloud), running (packets go up the link, a turning arrow), late (an amber link and mark), failed (a red link and
// mark, a red light on the server), no backup (a grey link). A 10 px concrete strip runs edge to edge under it.
const BK_NO_VALUE = new Set(["unknown", "unavailable", "none", ""]);
// Night picture: forced by illustration_theme, else the sun below the horizon or Home Assistant's dark mode
// (the dark theme shows the night picture even while the sun is up; an unavailable sun leaves the dark mode alone).
const bkIsNight = (hass, config) => {
  const theme = config?.illustration_theme;
  if (theme === "night") return true;
  if (theme === "day") return false;
  return hass?.states?.["sun.sun"]?.state === "below_horizon" || !!hass?.themes?.darkMode;
};
let bkUid = 0;
const BK_LINK = "M124 42 Q138 14 164 27";
// `state`: ok, running, late, failed or idle; `uid` keeps each card's ids apart on a page with several cards.
const bkSceneSvg = (state, uid) => {
  const leds = [0, 1, 2]
    .map(
      (i) =>
        `<rect class="bk-bay" x="104" y="${46 + i * 10}" width="26" height="8" rx="1"/><rect class="bk-slot2" x="113" y="${49.2 + i * 10}" width="13" height="1.6" rx=".8"/><circle class="bk-led${
          state === "failed" && i === 1 ? " bad" : ""
        }" cx="108" cy="${50 + i * 10}" r="1.3" style="animation-delay:${i * 0.3}s"/>`,
    )
    .join("");
  const packets =
    state === "running"
      ? [0, 1, 2].map((i) => `<rect class="bk-pk" x="-2.6" y="-2.6" width="5.2" height="5.2" rx="1" style="animation-delay:-${(i * 0.6).toFixed(1)}s;--d:${25 + i * 25}%"/>`).join("")
      : "";
  const mark = (cls, x, y) =>
    `<g class="bk-mark ${cls}" transform="translate(${x} ${y})"><circle r="6.5"/><path class="bk-mark-line" d="M0 -3.2v3.6M0 2.8v.3"/></g>`;
  const badge = {
    ok: '<g class="bk-mark ok" transform="translate(186 40)"><circle r="6.5"/><path class="bk-mark-line" d="M-2.8 0l1.9 1.9 3.6-3.8"/></g>',
    running:
      '<g class="bk-mark active" transform="translate(186 40)"><circle r="6.5"/><g class="bk-turn"><circle r="3.4" fill="none"/><path class="bk-mark-line" d="M0 -3.2a3.2 3.2 0 1 1 -3.2 3.2"/></g></g>',
    failed: mark("crit blink", 141, 24),
    late: mark("warn", 141, 24),
  }[state] || "";
  const stars = [
    [158, 14, 0.7],
    [170, 10, 0.5],
    [189, 14, 0.6],
    [160, 42, 0.5],
  ]
    .map(([x, y, r]) => `<circle class="bk-star" cx="${x}" cy="${y}" r="${r}"/>`)
    .join("");
  return `<svg class="bk-scene" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
    <defs><clipPath id="bk-win-${uid}"><rect x="151" y="7" width="42" height="40"/></clipPath></defs>
    <rect class="bk-frame" x="150" y="6" width="44" height="42" rx="2"/>
    <g clip-path="url(#bk-win-${uid})"><g class="bk-night-only">${stars}</g><path class="bk-puff" d="M154 16a3 3 0 0 1 5 -1.6a3.6 3.6 0 0 1 6.6 1.8a2 2 0 0 1 0 3.8h-10a2 2 0 0 1 -1.6 -4z"/></g>
    <g transform="translate(150 6) scale(1.2)"><path class="bk-cloud ${state}" d="M14 22a8 8 0 0 1 15 -3a6 6 0 0 1 6 10h-23a6 6 0 0 1 2 -7z"/></g>
    <path class="bk-link ${state}" d="${BK_LINK}"/>${packets}
    <rect class="bk-server" x="100" y="42" width="34" height="38" rx="3"/>${leds}
    <rect class="bk-disk" x="140" y="64" width="16" height="16" rx="2"/><rect class="bk-disk-top" x="143" y="67" width="10" height="2" rx="1"/><circle class="bk-led" cx="148" cy="75" r="1.1"/>
    ${badge}
  </svg>`;
};

const BK_BANNER_STYLE = `
  .banner { position: relative; overflow: hidden; height: 90px; --g: 10px; --sw: min(200px, max(104px, 42%));
            background: #e7eaee; color: #0d2a45; }
  .banner.night { background: #232a36; color: #fff; }
  .bk-scene { position: absolute; right: 0; bottom: var(--g); height: calc(100% - var(--g)); width: var(--sw); }
  .bk-ground { position: absolute; left: 0; right: 0; bottom: 0; height: var(--g); background: #9aa1a9; box-shadow: inset 0 2px 0 #b5bbc2; }
  .night .bk-ground { background: #2c323b; box-shadow: inset 0 2px 0 #3a414c; }
  .htext { position: absolute; z-index: 1; left: 12px; top: 0; bottom: var(--g); right: calc(var(--sw) + 4px); display: flex; align-items: center; gap: 10px; min-width: 0; }
  /* The titles are their own container: when the title row runs out of room, the pill drops under the subtitle. */
  .htext .titles { container: bk-titles / inline-size; flex: 1 1 0; align-self: stretch; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr);
                   align-content: center; row-gap: 2px; }
  /* The status pill right after the title, centred on it, in the icon's color; the title ellipsises first and keeps
     4 characters. */
  .htext .tline { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .htext .tline .name { flex: 0 1 auto; min-width: 4ch; }
  .banner .chip { flex: 0 0 auto; margin: 0; max-width: 100%; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; line-height: 16px;
                  background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner.night .chip { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
  .banner .chip .dot { width: 7px; height: 7px; }
  @container bk-titles (max-width: 190px) {
    .htext .tline { display: contents; }
    .banner .chip { grid-row: 3; justify-self: start; margin-top: 1px; }
  }
  @container bk-card (max-width: 230px) { .banner .chip { padding: 1px 8px; } .banner .chip .chip-text { display: inline; } }
  @container bk-card (max-width: 200px) { .banner .chip { padding: 4px; } .banner .chip .chip-text { display: none; } }
  .htext .name { font-size: 16px; font-weight: 500; }
  .htext .sub { font-size: 13px; color: #3b5b78; }
  .night .htext .sub { color: rgba(255,255,255,.78); }
  /* The round icon on the wall: its color is the worst status (green, blue while running, amber, red, grey). */
  .banner .type-icon { background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bk-tint) 22%, transparent); }
  .banner .type-icon .icon { fill: color-mix(in srgb, var(--bk-tint) 82%, #0d2a45); }
  .banner.night .type-icon { background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
  .banner.night .type-icon .icon { fill: color-mix(in srgb, var(--bk-tint) 72%, #fff); }
  /* The mini card's expand / collapse button: a 24 px frosted disc in the banner's top-right corner. */
  .banner .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; margin: 0; width: 24px; height: 24px; color: #33506b; background: rgba(255,255,255,.55);
                  box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
  .banner .zoom:hover { background: rgba(255,255,255,.75); color: #33506b; }
  .banner.night .zoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .banner.night .zoom:hover { background: rgba(255,255,255,.22); color: #fff; }
  .bk-frame { fill: #cfe8f8; stroke: #fff; stroke-width: 2; }
  .night .bk-frame { fill: #1b2f52; stroke: #4a5568; }
  .bk-puff { fill: #fff; opacity: .75; }
  .night .bk-puff { opacity: .12; }
  .bk-night-only { display: none; } .night .bk-night-only { display: inline; }
  .bk-star { fill: #fff; animation: bk-twinkle 1.2s ease-in-out infinite; }
  .bk-star:nth-child(2n) { animation-delay: -.6s; }
  .bk-cloud { fill: #fff; stroke: var(--bk-active); stroke-width: 1.2; }
  .bk-cloud.failed { stroke: var(--bk-crit); } .bk-cloud.late { stroke: var(--bk-warn); } .bk-cloud.idle { stroke: #9aa3ae; }
  .bk-link { fill: none; stroke: #9aa3ae; stroke-width: 1.6; stroke-dasharray: 3 3; }
  .night .bk-link { stroke: #5a6578; }
  .bk-link.running { stroke: color-mix(in srgb, var(--bk-active) 55%, #9aa3ae); animation: bk-flow .6s linear infinite; }
  .bk-link.failed { stroke: var(--bk-crit); } .bk-link.late { stroke: var(--bk-warn); }
  .bk-pk { fill: var(--bk-active); offset-path: path("${BK_LINK}"); offset-rotate: 0deg; animation: bk-pk 1.8s linear infinite; }
  .bk-server { fill: #2a3038; } .night .bk-server { fill: #1d2229; stroke: #3c4558; stroke-width: .8; }
  .bk-bay { fill: #3d4552; } .bk-slot2 { fill: #56606e; }
  .bk-led { fill: #43c463; animation: bk-blink 1.2s steps(2) infinite; } .bk-led.bad { fill: var(--bk-crit); }
  .bk-disk { fill: #5f6b7a; } .night .bk-disk { fill: #4a5462; } .bk-disk-top { fill: #9aa3ae; }
  .bk-mark circle { fill: var(--c); } .bk-mark .bk-turn circle { fill: none; }
  .bk-mark-line { fill: none; stroke: #fff; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .bk-mark.blink { animation: bk-blink 1.2s steps(2) infinite; }
  .bk-turn { transform-box: fill-box; transform-origin: center; animation: bk-spin 1.2s linear infinite; }
  @keyframes bk-pk { from { offset-distance: 0%; opacity: 0; } 15%, 85% { opacity: 1; } to { offset-distance: 100%; opacity: 0; } }
  @keyframes bk-flow { to { stroke-dashoffset: -6; } }
  @keyframes bk-blink { 50% { opacity: .25; } }
  @keyframes bk-twinkle { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }
  /* Still: the packets wait along the link. Every period divides 1.2 s, so that the README's GIF loops. */
  @media (prefers-reduced-motion: reduce) { .bk-pk { offset-distance: var(--d); } }
  /* Too narrow for the picture beside the title and the status pill: the wall alone stays. */
  @container (max-width: 260px) { .bk-scene { display: none; } .htext { right: 36px; } }
`;

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

class BackupCard extends CardBase {
  static getConfigElement() {
    return document.createElement("backup-card-editor");
  }

  getCardSize() {
    return 5;
  }

  _build() {
    return resolve(this._hass, this._config);
  }

  _entityIds(m) {
    return m.flatMap((src) => (src.drive ? [src.drive] : Object.values(src.parts).filter(Boolean)));
  }

  _extraDeps() {
    return [this._startedAt, this._hass?.states?.["sun.sun"]?.state];
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

class BackupMiniCard extends withMini(BackupCard) {
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

// ---------------------------------------------------------------------------
// Visual editors
// ---------------------------------------------------------------------------

class BackupCardEditor extends EditorBase {
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

  _fields() {
    const tr = (k) => t(this._hass, this._config, k);
    return [
      { name: "backups", selector: { entity: { multiple: true, domain: "sensor" } } },
      { name: "max_age", selector: { number: { min: 1, max: 24 * 60, mode: "box", unit_of_measurement: "h" } } },
      { name: "illustration_theme", selector: { select: { mode: "dropdown", options: ["auto", "day", "night"].map((value) => ({ value, label: tr(`theme_${value}`) })) } } },
    ];
  }
}

// The mini card's detail view is the full card: its editor offers the full card's options, plus the detail button.
class BackupMiniCardEditor extends BackupCardEditor {
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
