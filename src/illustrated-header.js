// ---------------------------------------------------------------------------
// Illustrated header
// ---------------------------------------------------------------------------

// The banner: the title on the left, over the wall of a server room; on the right (a 200 × 80 picture drawn to the
// right edge, its empty left part cropped on a narrow card) the home server and its backup disk standing on the
// floor, a link up to a cloud seen through the window. Its state is the worst one: up to date (a green check on the
// cloud), running (packets go up the link, a turning arrow), late (an amber link and mark), failed (a red link and
// mark, a red light on the server), no backup (a grey link). A 10 px concrete strip runs edge to edge under it.
export const BK_NO_VALUE = new Set(["unknown", "unavailable", "none", ""]);
// Night picture: forced by illustration_theme, else Home Assistant's dark mode alone (a light theme keeps the day
// picture after sunset).
export const bkIsNight = (hass, config) => {
  const theme = config?.illustration_theme;
  if (theme === "night") return true;
  if (theme === "day") return false;
  return !!hass?.themes?.darkMode;
};
export const BK_LINK = "M124 42 Q138 14 164 27";
// `state`: ok, running, late, failed or idle; `uid` keeps each card's ids apart on a page with several cards.
export const bkSceneSvg = (state, uid) => {
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

export const BK_BANNER_STYLE = `
  .banner { position: relative; overflow: hidden; height: 90px; --g: 10px; --sw: min(200px, max(104px, 42%));
            background: #e7eaee; color: #0d2a45; }
  .banner.night { background: #232a36; color: #fff; }
  .bk-scene { position: absolute; right: 0; bottom: var(--g); height: calc(100% - var(--g)); width: var(--sw); }
  .bk-ground { position: absolute; left: 0; right: 0; bottom: 0; height: var(--g); background: #9aa1a9; box-shadow: inset 0 2px 0 #b5bbc2; }
  .night .bk-ground { background: #2c323b; box-shadow: inset 0 2px 0 #3a414c; }
  .htext { position: absolute; z-index: 1; left: 12px; top: 0; bottom: var(--g); right: calc(var(--sw) + 4px); display: flex; align-items: center; gap: 10px; min-width: 0; }
  .htext .titles { flex: 1 1 0; align-self: stretch; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr);
                   align-content: center; row-gap: 2px; }
  /* The status pill right after the title, centred on it, in the icon's color. */
  /* The status pill right after the title, its whole label on one line, while the title stays whole beside it
     (measured by the card, see _fitPill); otherwise on its own line under a one-line subtitle, and with its dot alone
     when even that does not fit the header. */
  .tline { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .tline > .name { flex: 0 1 auto; min-width: 0; }
  .tline > .chip { flex: none; max-width: none; }
  .tline > .chip .chip-text { white-space: nowrap; overflow: visible; }
  .htext .titles.below { display: grid; grid-template-columns: minmax(0, 1fr); align-content: center; }
  .htext .titles.below > .tline { display: contents; }
  .htext .titles.below > .tline > .chip { order: 3; justify-self: start; align-self: start; margin-top: 3px; }
  .htext .titles.below > .sub { order: 2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .htext .titles.dot-only > .tline { display: flex; }
  .htext .titles.dot-only > .tline > .chip { order: 0; margin-top: 0; align-self: center; padding: 4px; }
  .htext .titles.dot-only > .tline > .chip .chip-text { display: none; }
  .banner .chip { margin: 0; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; line-height: 16px;
                  background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner.night .chip { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
  .banner .chip .dot { width: 7px; height: 7px; }
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
