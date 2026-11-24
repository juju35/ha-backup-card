// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// The illustration of the hero: servers sending to a cloud, with a badge of the worst status. Colors come from the
// theme so that it reads in light and dark modes; while a backup runs, the arrow into the cloud moves.
export const art = (status, running = status === "running") => {
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

export const BACKUP_STYLE = `
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
