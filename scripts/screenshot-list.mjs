// The README screenshots (PNG) and animations (GIF) rendered by scripts/screenshots.mjs.
// Every capture has a twin in the other theme ("-dark" for a light capture) that shows exactly the same state: only
// the theme differs (checked by test/screenshots.test.mjs). `variant` picks the mock data (scripts/mock-states.mjs).
const twins = (list) => list.flatMap((s) => [{ ...s, theme: "light" }, { ...s, file: `${s.file}-dark`, theme: "dark" }]);

export const shots = twins([
  { file: "card", type: "backup-card", width: 460, config: {} },
  { file: "card-ok", type: "backup-card", width: 460, config: { show_stats: false }, variant: "ok" },
  { file: "mini-card", type: "backup-mini-card", width: 380, config: {} },
  { file: "mini-card-ok", type: "backup-mini-card", width: 380, config: {}, variant: "ok" },
  { file: "mini-card-zoom", type: "backup-mini-card", width: 460, config: {}, clicks: [".zoom"] },
  // Narrow cards: the full card at 6 columns of a phone's Sections view and the mini card at its minimum width.
  { file: "card-narrow", type: "backup-card", width: 238, config: {} },
  { file: "mini-card-narrow", type: "backup-mini-card", width: 170, config: {} },
]);

// One looping GIF per distinct animated state:
//   running — backups run: the arrow goes into the cloud, an arc turns round their source, the button's icon turns
export const gifs = twins([{ file: "running", type: "backup-card", width: 460, config: {}, variant: "running", seconds: 1.2 }]);
