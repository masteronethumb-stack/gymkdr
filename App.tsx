/* GYMKDR · the app. The One Thumb studio mark, then the hand sweep (every cold launch, pre-filled
   after the first), then straight to where the lifter left off. Everything below the sweep is laid
   out inside the measured reach of one thumb. */
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import CH from './src/boot';
import { ThemeProvider, useTheme } from './src/ui/theme';
import Display from './src/ui/Display';
import { Hub, ReachFlash, Rim } from './src/ui/Stage';
import Wheel from './src/ui/Wheel';
import Toast, { toast } from './src/ui/Toast';
import Ask from './src/ui/Ask';
import Sweep from './src/ui/Sweep';
import Splash from './src/ui/Splash';
import { flashAtom, handAtom, sizeAtom } from './src/ui/store';
import { touch } from './src/ui/geo';

SplashScreen.preventAutoHideAsync().catch(() => {});

const FONTS = {
  BarlowCondensed_500Medium: require('@expo-google-fonts/barlow-condensed/500Medium/BarlowCondensed_500Medium.ttf'),
  BarlowCondensed_600SemiBold: require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf'),
  BarlowCondensed_700Bold: require('@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf'),
  AtkinsonHyperlegible_400Regular: require('@expo-google-fonts/atkinson-hyperlegible/400Regular/AtkinsonHyperlegible_400Regular.ttf'),
  AtkinsonHyperlegible_400Regular_Italic: require('@expo-google-fonts/atkinson-hyperlegible/400Regular_Italic/AtkinsonHyperlegible_400Regular_Italic.ttf'),
  AtkinsonHyperlegible_700Bold: require('@expo-google-fonts/atkinson-hyperlegible/700Bold/AtkinsonHyperlegible_700Bold.ttf'),
};

// Where to go once the sweep is done: a workout in progress, else Home.
function home() {
  const st = CH.store.state;
  if (st.active) return 'session';
  if (!st.routines.length) return 'welcome';
  return 'today';
}

let splashDone: () => void = () => {};
const splashOver = new Promise<void>((r) => { splashDone = r; });

async function boot() {
  await CH.store.load();
  CH.store.init();
  CH.reach.init();
  handAtom.set(CH.reach.hand);
  CH.ui.init();
  CH.bus.on('hand', ({ to }: { to: string }) => {
    // An open menu belongs to the old hand: close it.
    CH.scrub.dismiss();
    handAtom.set(to);
    CH.stage.swapHands();
    toast(`${CH.icon('sweep')}<span>${to === 'right' ? 'Right' : 'Left'} thumb</span>`);
  });
  CH.bus.on('reach', () => { handAtom.set(CH.reach.hand); CH.stage.layout(); CH.scrub.relayout(); });
  // The screen behind the sweep, so the first frame is the app, not a blank page.
  const first = home();
  CH.ui.show(first === 'session' ? 'today' : first);
}

function Shell() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);
  const [fonts] = useFonts(FONTS);
  const w = useRef<{ pts: { x: number; y: number }[]; t0: number } | null>(null);

  // The app's box: the screen inside the safe area. Every control is placed in it.
  const W = win.width - insets.left - insets.right, H = win.height - insets.top - insets.bottom;
  useEffect(() => {
    sizeAtom.set({ W, H, top: insets.top, left: insets.left });
    CH.reach.setSize(W, H);
    if (ready) { CH.stage.layout(); CH.scrub.relayout(); }
  }, [W, H, insets.top, insets.left, ready]);

  useEffect(() => {
    CH.reach.setSize(W, H);
    boot().then(() => setReady(true)).catch((e) => { console.error(e); setReady(true); });
  }, []);
  useEffect(() => { if (ready && fonts) SplashScreen.hideAsync().catch(() => {}); }, [ready, fonts]);

  // After the studio mark: the hand sweep, then where the lifter left off.
  useEffect(() => {
    if (!ready) return;
    let gone = false;
    (async () => {
      await splashOver;
      await CH.reach.calibrate();
      if (gone) return;
      CH.stage.layout();
      const next = home();
      if (next === 'session') CH.session.resume(); else CH.ui.show(next);
    })();
    return () => { gone = true; };
  }, [ready]);

  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => { if (st !== 'active') CH.store.flush(); });
    return () => s.remove();
  }, []);

  /* The hand watcher: every touch is watched (it never takes the touch). A clean, wide arc round the
     other corner swaps hands; a tap outside the reach that didn't land on a control shows the reach. */
  const pt = (e: any) => ({ x: e.nativeEvent.pageX - insets.left, y: e.nativeEvent.pageY - insets.top });
  const onTouchStart = (e: any) => {
    if (CH.reach.open || (e.nativeEvent.touches && e.nativeEvent.touches.length > 1)) { w.current = null; return; }
    w.current = { pts: [pt(e)], t0: Date.now() };
  };
  const onTouchMove = (e: any) => { if (w.current) w.current.pts.push(pt(e)); };
  const onTouchEnd = (e: any) => {
    const t = w.current, onControl = touch.onControl;
    w.current = null;
    touch.onControl = false;
    if (!t || CH.reach.open) return;
    const p0 = t.pts[0], p1 = pt(e);
    if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 10 && !onControl && !CH.scrub.isOpen() && !CH.reach.inReach(p0.x, p0.y, -4)) flashAtom.set(flashAtom.get() + 1);
    t.pts.push(p1);
    CH.reach.watchEnd(t.pts, Date.now() - t.t0);
  };

  const live = ready && fonts;
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <StatusBar style={th.dark ? 'light' : 'dark'} />
      <View
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { w.current = null; touch.onControl = false; }}
        style={[{ position: 'absolute', left: insets.left, top: insets.top, width: W, height: H, overflow: 'hidden' }, Platform.OS === 'web' ? ({ userSelect: 'none', touchAction: 'none' } as any) : null]}
      >
        {live ? (
          <>
            <Display />
            <Rim />
            <Wheel />
            <Hub />
            <ReachFlash />
            <Toast />
            <Ask />
            <Sweep />
          </>
        ) : null}
      </View>
      {splash && fonts ? <Splash reduced={!!(CH.store.state && CH.store.state.settings && CH.store.state.settings.motion === 'reduced')} onDone={() => { splashDone(); setTimeout(() => setSplash(false), 450); }} /> : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = 'en-AU';
