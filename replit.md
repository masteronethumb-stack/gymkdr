# GYMKDR on Replit

GYMKDR (Gym Recorder) is an Expo / React Native app on **Expo SDK 57**. Read `AGENTS.md` before
changing anything: it explains how the app is built (one root, no Expo Router, every menu is the
thumb wheel) and the rules that keep it a one-thumb app.

- Run: `npx expo start` and open it in Expo Go.
- Add a package: `npx expo install <package>`, never a plain `npm install <package>`.
- Check: `npx tsc --noEmit` and `npx expo export --platform web`.
- Don't upgrade the Expo SDK while the app is being tested in the store version of Expo Go.
- Store checklist: see "Before it goes to the App Store or Google Play" in `README.md`.
