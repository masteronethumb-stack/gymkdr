# GYMKDR

**Gym Recorder.** A one-thumb training log for iPhone and Android, built with Expo and React Native.

Everything is done with one button, the Start button, inside the reach of the thumb holding the
phone. Press it and the choices rise in a column above it; slide the thumb to roll through them; tap
the button to choose the lit one. The top of the screen is only for reading.

Every cold launch opens with the One Thumb studio mark, then the hand sweep: sweep your thumb from
the side of the screen down to the bottom edge, and GYMKDR puts its button inside that arc, on that
side. On later launches the saved sweep keeps itself after a short countdown. Sweeping the other
thumb, any time, swaps hands.

GYMKDR is the React Native rebuild of Chalk (the web version). `docs/PORT_NOTES.md` says what moved
where and what changed.

## Run it

You need Node 20 or later.

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (iPhone: the Camera app; Android: Expo Go itself). The app
targets **Expo SDK 57**, the SDK the current store version of Expo Go runs.

`npx expo start --web` runs it in a browser, which is handy for a quick look. The browser has no
haptics, keep-awake or rest notifications, and a mouse drag stands in for the thumb.

### On Replit

1. Create a Replit App and choose **Import from GitHub**, then pick this repository.
2. Replit recognises it as an Expo app. Press **Run**: it installs the packages and starts the Expo
   server, with a QR code to open the app in Expo Go on your phone.
3. When you're ready for the stores, use Replit's publishing for Expo apps. iOS needs an Apple
   Developer account; Android needs a Google Play developer account. Replit's own guide for
   publishing Expo apps walks through it, and its Agent can do the steps for you.

If Replit asks to upgrade the Expo SDK, say no unless the store version of Expo Go has moved to the
newer SDK too, or you only test with development builds.

## Before it goes to the App Store or Google Play

- **Bundle identifier and package name.** `app.json` uses `com.onethumb.gymkdr` for both. Change it
  to a reverse domain you control before the first build; it can't change after release.
- **Privacy.** GYMKDR keeps everything on the phone: no account, no analytics, no network. The
  store listing still needs a privacy policy URL; it can say exactly that. In App Store Connect the
  privacy answer is "Data Not Collected".
- **Notifications.** The rest timer asks to send notifications the first time a rest starts, so the
  end of a rest is announced with the phone locked. Nothing else uses them.
- **Review notes for Apple.** Explain the sweep, or the reviewer may not get past the first screen:
  "On launch, sweep your thumb from the right edge of the screen down to the bottom edge (or wait
  for the countdown on later launches). Then tap the round Start button; its choices appear above
  it. Slide up or down on the button to move through them, and tap it to choose."
- **iPad.** `supportsTablet` is off, so on an iPad GYMKDR runs in iPhone compatibility mode. Apple
  still reviews it on an iPad, so check the sweep and the button there once.
- **Icons and screenshots.** `assets/icon.png` and the Android icons are a plain GYMKDR mark, fine
  for testing. Store screenshots come from a real phone or the simulator.
- **Google Play, personal developer accounts.** New personal accounts must run a closed test (at
  least 12 testers for 14 days) before the app can go to production.

## How the code is laid out

| Path | What it is |
|---|---|
| `App.tsx` | The root: fonts, the safe area, the layers (reading column, rim, wheel, hub, toast, name sheet, sweep, studio mark), the boot sequence and the hand watcher |
| `src/boot.js` | Loads the modules in the order they depend on each other |
| `src/ch.js` | The shared `CH` object each module hangs its part on |
| `src/logic/` | Plain JavaScript with no screens in it: storage and utilities (`core.js`), the exercise library (`data.js`), targets and reviews (`engine.js`), CSV import, cardio, the reach maths, the corner layout, the thumb wheel's state, rest notifications and files |
| `src/screens/` | The screens: building a routine (`setup.jsx`), a workout (`session.jsx`) and everything else (`screens.jsx`) |
| `src/ui/` | React Native components: theme, type, icons, the Start button and rim, the wheel, the sweep, the studio mark, the toast and the name sheet |

Each screen draws itself into the reading column with `CH.ui.setView(name, element)` and hands the
corner its controls with `CH.stage.set({ hub, rim })`. Every menu is a wheel spec:

```js
{ title: 'Which body part?', options: [{ label, sub, info, act }], start: 0 }
```

`info` is a short HTML snippet (`<p>`, `<ul><li>Name<span>3 × 8</span></li></ul>`, `<dl>`, `<b>`),
drawn as native text by `src/ui/Rich.tsx`.

Data lives in AsyncStorage on the phone, loaded into memory at launch. Settings › Download a full
backup hands a JSON file to the share sheet, and Settings › Import or restore reads it back, along
with CSV exports from Strong, Hevy, GYMKDR and Chalk.

## Checks

```bash
npx tsc --noEmit
npx expo export --platform web
```
