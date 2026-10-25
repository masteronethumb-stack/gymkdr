# GYMKDR: how Chalk was ported to Expo / React Native

GYMKDR (short for Gym Recorder) is the React Native rebuild of Chalk 12.12, the vertical-split build.
It's built on Expo SDK 57, the SDK the current store version of Expo Go runs.

## Layout

| Path | What it is |
|---|---|
| `App.tsx` | Root: fonts, safe area, the boot sequence, the hand watcher, and the layers (reading column, rim, wheel, hub, toast, name sheet, sweep, studio mark) |
| `src/boot.js` | Loads the modules in order (core first), as Chalk's script tags did |
| `src/ch.js` | The shared `CH` object every module hangs off, as in Chalk |
| `src/logic/core.js` | Utilities, events, device storage (AsyncStorage, preloaded), store, routines, haptics, sound, keep-awake |
| `src/logic/data.js` | Muscles, patterns, kit, the exercise library, plans (Chalk's data.js, unchanged) |
| `src/logic/engine.js` | Targets, PRs, coverage, review (unchanged) |
| `src/logic/importer.js` | Strong, Hevy, GYMKDR and Chalk CSV import |
| `src/logic/cardio.js` | Cardio types, machines, settings, results and their wheels |
| `src/logic/reach.js` | The reach profile and its maths: polar co-ordinates, judging a sweep, the other-thumb swap |
| `src/logic/stageLayout.js` | Where the Start button and rim buttons sit inside the reach (Chalk's stage.js solver) |
| `src/logic/stage.js` | `CH.stage`: a screen's controls, folding into More, lists as wheels |
| `src/logic/wheel.js` | `CH.scrub`: the thumb wheel's state machine (Chalk's scrub.js, without the DOM) |
| `src/logic/notify.js` | The rest timer's notification |
| `src/logic/files.js` | Picking a file to import; handing an export to the share sheet |
| `src/screens/setup.jsx` | Building a routine |
| `src/screens/session.jsx` | Logging a workout |
| `src/screens/screens.jsx` | Home, Calendar, lift chart, Routines, Week, Progress, Review, Routine, Settings, Done, and `CH.ui` |
| `src/ui/*` | React Native components: theme, type kit, icons, Stage (hub and rim), Wheel, Sweep, Splash (studio mark), Toast, Ask (name sheet), Display (reading column), Rich (wheel descriptions) |

## How rendering works

Chalk built HTML strings and set `innerHTML`. Here each screen's render function builds React Native
elements and hands them to `CH.ui.setView(name, element)`. The root component shows the current
view. Controls are set with `CH.stage.set({ hub, rim })`, as in Chalk, and menus are wheel specs
(`{ title, options: [{ label, sub, info, act }], start }`). A wheel option's `info` is a short HTML
snippet (p, ul/li with a span, dl/dt/dd, b), drawn by `ui/Rich.tsx`.

## Not carried over

- **Account sync** through the claude.ai artifact database. Data lives on the phone. Backups
  export through the share sheet, and Settings › Import or restore reads them back.
- **The horizontal split** (choices beside the button). GYMKDR is the vertical build only.
- **The browser's speech recognition.** The iPhone keyboard's microphone does the same job in any
  text field.

## The seven fixes from the calendar test (24 October 2026)

1. Planned days show the workout each will be (Push, Pull, Legs in turn), not the routine's first word.
2. While Dates is open, the reading side shows the picked day's week as a strip, with that day's
   workouts under it, on a plain card over the washed-out calendar.
3. The calendar has Earlier and Next buttons, so any month can be opened (to see a coming month's
   planned days, say) without changing the day picked.
4. Building a day: the wheel lights the first movement (and version) not already in the day. Choosing
   one that's already there asks before adding it twice.
5. A choice whose shortened text would be empty ("Seated") keeps its full words.
6. The Start button is never rebuilt under a press (React keeps the same view). When rest ends,
   only the rest button changes.
7. A first-time bodyweight exercise says "Aim for 6–10 reps" on the workout screen, as Home does;
   an assisted one says "Pick the help you need for 6–10 reps".
