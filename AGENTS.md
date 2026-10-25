# Working on GYMKDR

GYMKDR is an Expo / React Native app (Expo SDK 57). It's a port of Chalk, a web app, and keeps
Chalk's structure on purpose: read `README.md` and `docs/PORT_NOTES.md` first.

## Expo has changed: don't trust remembered APIs

Expo ships breaking changes every SDK release. Before writing code that touches an Expo or React
Native API, check the major version of `expo` in `package.json` and read the matching docs at
`https://docs.expo.dev/versions/v57.0.0/` (or the `.d.ts` files under `node_modules`).

## Commands

```bash
npx expo install <package>   # always, instead of npm install <package>: picks the SDK 57 version
npx expo start               # dev server; open in Expo Go
npx tsc --noEmit             # type check
npx expo export --platform web   # a full bundle, which catches import and syntax errors
```

Stay on SDK 57 until the store version of Expo Go supports a newer SDK: the app is tested in Expo Go.

## How it's built (and what not to change by accident)

- **No Expo Router.** There's one root (`App.tsx`) and one set of layers. Screens are not routes: a
  screen draws itself into the reading column with `CH.ui.setView(name, element)` and sets the
  thumb's corner with `CH.stage.set({ hub, rim })`. Navigation is `CH.ui.show(name)`.
- **One shared object, `CH`.** Each module hangs its part on it (`CH.u`, `CH.store`, `CH.data`,
  `CH.engine`, `CH.scrub`, `CH.stage`, `CH.ui`…). `src/boot.js` loads them in order; keep it that way.
- **Every menu is the thumb wheel.** A menu is a spec (`{ title, options, start }`) opened with
  `CH.scrub.open(spec, 'hub', 'sticky')` or `CH.stage.list({ title, rows })`. Don't add modal
  pickers, alerts or buttons in the reading column: everything the thumb touches lives in the
  corner, inside the measured reach.
- **The One Thumb standards.** The studio mark and the hand sweep run on every cold launch. The
  Start button and the rim are placed inside the swept reach (`src/logic/stageLayout.js`). Sweeping
  the other thumb swaps hands. Text stays left-aligned for either hand.
- **Words.** Australian English. Plain words for a beginner ("the back of your thighs"), gym
  shorthand only on the short chips. No icons without a word beside them.
- **Data stays on the phone.** No accounts, analytics or network calls.
