/* GYMKDR · the hand sweep, every cold launch (the One Thumb standard). Sweep the widest arc your
   thumb reaches comfortably, from the side of the screen down to the bottom edge: that chooses the
   side the button goes on and how far out it can sit. On relaunch the saved sweep is shown and keeps
   itself after a short countdown; there is no button for touch. With a screen reader, the hand is
   chosen with two buttons instead. */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, Polygon, Polyline, RadialGradient, Stop } from 'react-native-svg';
import CH from '../ch';
import { F, useTheme } from './theme';
import { handAtom, sizeAtom, sweepAtom, useAtom } from './store';
import { appPoint } from './geo';

const U = CH.u;
const COUNT_MS = 2200;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const reduced = () => !!(CH.store && CH.store.state && CH.store.state.settings && CH.store.state.settings.motion === 'reduced');

CH.reach.calibrate = (reason?: string) => new Promise<void>((resolve) => {
  CH.reach.open = true;
  sweepAtom.set({ reason, resolve });
});

type Measured = { hand: 'left' | 'right'; r: number[] } | null;
const hi = (h: string) => (h === 'right' ? 'right' : 'left');

export default function Sweep() {
  const th = useTheme();
  const job = useAtom(sweepAtom);
  const { W, H } = useAtom(sizeAtom);
  const [measured, setMeasured] = useState<Measured>(null);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [count, setCount] = useState<string | null>(null);
  const [sr, setSr] = useState(false);
  const ring = useRef(new Animated.Value(0)).current;
  const ghost = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const live = useRef<{ pts: { x: number; y: number }[]; drag: boolean; idle: any; measured: Measured; done: boolean; raf?: any }>({ pts: [], drag: false, idle: 0, measured: null, done: false });

  // (A browser can't tell, so there the buttons stay hidden until a keyboard reaches them.)
  useEffect(() => { if (Platform.OS !== 'web') AccessibilityInfo.isScreenReaderEnabled().then(setSr).catch(() => {}); }, []);

  // A new sweep job: welcome back (the saved reach, keeping itself), or the first sweep.
  useEffect(() => {
    if (!job) return;
    fade.setValue(1);
    const R = CH.reach;
    const m: Measured = R.prof ? { hand: R.prof.hand, r: R.prof.r[R.prof.hand] } : null;
    live.current = { pts: [], drag: false, idle: 0, measured: m, done: false };
    setMeasured(m);
    setPts([]);
    if (m) {
      setTitle(job.reason === 'resweep' ? 'Sweep your thumb again' : 'Welcome back');
      setText(job.reason === 'resweep'
        ? 'Sweep the widest arc your thumb reaches comfortably, from the side of the screen down to the bottom edge.'
        : `Your ${hi(m.hand)}-thumb reach is still saved. To keep it, wait. To change it or swap hands, sweep again, from the side down to the bottom.`);
      startCount('Keeping where your thumb reaches', job.reason === 'resweep' ? 5000 : COUNT_MS);
    } else {
      setTitle('Sweep your thumb');
      setText("Hold the phone in the hand you'll use at the gym. With that thumb, sweep the widest arc it reaches comfortably, from the side of the screen down to the bottom edge. GYMKDR puts its button inside that arc, on that side.");
    }
    return () => { stopCount(); };
  }, [job]);

  // The guides draw themselves on, again and again, until the first touch.
  const showGhost = !!job && !measured && !pts.length;
  useEffect(() => {
    if (!showGhost) { ghost.stopAnimation(); return; }
    if (reduced()) { ghost.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ghost, { toValue: 0, duration: 0, useNativeDriver: false }),
      Animated.timing(ghost, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.delay(1400),
    ]));
    loop.start();
    return () => loop.stop();
  }, [showGhost]);

  function stopCount() { ring.stopAnimation(); setCount(null); }
  function startCount(msg: string, ms = COUNT_MS) {
    setCount(msg);
    ring.stopAnimation();
    ring.setValue(0);
    Animated.timing(ring, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => { if (finished) finish(); });
  }
  function finish() {
    const L = live.current;
    if (L.done || !L.measured) return;
    L.done = true;
    clearTimeout(L.idle);
    const R = CH.reach, m = L.measured;
    if (!R.prof) R.prof = { hand: m.hand, r: {} };
    R.prof.hand = m.hand;
    R.prof.r[m.hand] = m.r;
    R.save();
    handAtom.set(m.hand);
    Animated.timing(fade, { toValue: 0, duration: reduced() ? 1 : 240, useNativeDriver: false }).start(() => {
      R.open = false;
      const j = sweepAtom.get();
      sweepAtom.set(null);
      setCount(null);
      CH.bus.emit('reach', 'set');
      if (j) j.resolve();
    });
  }
  function judge() {
    const L = live.current;
    const res = CH.reach.judge(L.pts);
    L.pts = [];
    setPts([]);
    if (!res.ok) {
      CH.haptic('warning');
      setTitle(res.why === 'wrongWay' ? 'From the side to the bottom' : 'Try a wider arc');
      setText(res.why === 'wrongWay'
        ? 'Sweep the other way: start up the side of the screen and finish at the bottom edge.'
        : 'Start up the side of the screen and sweep your thumb round and down to the bottom edge, in one smooth arc, as far as it comfortably goes.');
      const R = CH.reach;
      L.measured = R.prof ? { hand: R.prof.hand, r: R.prof.r[R.prof.hand] } : null;
      setMeasured(L.measured);
      return;
    }
    L.measured = { hand: res.hand, r: res.r };
    setMeasured(L.measured);
    CH.haptic('impact');
    setTitle(`Got it: ${hi(res.hand)} thumb`);
    setText("The button sits inside this shape, and it's the one thing you touch: it opens every choice. To redo it, sweep again. To swap hands later, sweep the other thumb from its side down to the bottom, any time.");
    startCount('Saving where your thumb reaches');
  }
  // Without a thumb to sweep (VoiceOver, TalkBack, a keyboard): the reach saved for that hand, or a typical one.
  function choose(hand: 'left' | 'right') {
    const L = live.current;
    stopCount();
    L.measured = { hand, r: L.measured && L.measured.hand === hand ? L.measured.r : CH.reach.radii(hand) };
    CH.sound.unlock();
    CH.haptic('impact');
    finish();
  }

  if (!job) return null;
  /* A sweep can't get stuck: a lift ends it; if the touch goes quiet, the sweep ends itself with what
     it has; and a new touch always starts a fresh sweep. */
  const poke = () => { const L = live.current; clearTimeout(L.idle); L.idle = setTimeout(() => { if (L.drag) { L.drag = false; judge(); } }, 900); };
  const handlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: any) => {
      const L = live.current;
      if (L.done) return;
      ring.stopAnimation(); setCount(null);
      L.drag = true;
      L.pts = [appPoint(e)];
      setPts(L.pts.slice());
      CH.sound.unlock();
      poke();
    },
    onResponderMove: (e: any) => {
      const L = live.current;
      if (!L.drag) return;
      L.pts.push(appPoint(e));
      poke();
      if (!L.raf) L.raf = requestAnimationFrame(() => { L.raf = 0; setPts(L.pts.slice()); });
    },
    onResponderRelease: () => {
      const L = live.current;
      if (!L.drag) return;
      L.drag = false;
      clearTimeout(L.idle);
      try { judge(); } catch (err) {
        setPts([]);
        setTitle('Sweep again');
        setText('Start up the side of the screen and sweep your thumb round and down to the bottom edge, in one smooth arc.');
      }
    },
    onResponderTerminate: () => { const L = live.current; if (L.drag) { L.drag = false; try { judge(); } catch (e) { /* asks again */ } } },
  };

  // The guide for each thumb runs from the side down to the bottom edge and ends in an arrowhead.
  const ghostR = U.clamp(Math.min(W * 0.42, H * 0.4), 120, 300);
  const ghostPath = (h: string) => { let d = ''; for (let a = 86; a >= 10; a -= 2) { const p = CH.reach.fromPolar(a, ghostR, h); d += (d ? 'L' : 'M') + U.f1(p.x) + ' ' + U.f1(p.y); } return d; };
  const ghostArrow = (h: string) => {
    const tip = CH.reach.fromPolar(1, ghostR, h), back = CH.reach.fromPolar(10, ghostR, h);
    const dx = tip.x - back.x, dy = tip.y - back.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const b = { x: tip.x - ux * 30, y: tip.y - uy * 30 }, s = 22;
    return `${U.f1(tip.x)},${U.f1(tip.y)} ${U.f1(b.x - uy * s)},${U.f1(b.y + ux * s)} ${U.f1(b.x + uy * s)},${U.f1(b.y - ux * s)}`;
  };
  const GL = ghostR * ((76 * Math.PI) / 180) + 10;
  const region = measured ? CH.reach.path(measured.hand, measured.r) : null;
  const C = 2 * Math.PI * 16;
  return (
    <Animated.View testID="sweep" {...handlers} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: th.bg, opacity: fade }}>
      <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
        <Defs>
          <RadialGradient id="swFill" gradientUnits="userSpaceOnUse" cx={measured && measured.hand === 'left' ? 0 : W} cy={H} r={Math.max(W, H) * 0.6}>
            <Stop offset="0" stopColor={th.accent} stopOpacity={0.26} />
            <Stop offset="0.75" stopColor={th.accent} stopOpacity={0.1} />
            <Stop offset="1" stopColor={th.accent} stopOpacity={0.03} />
          </RadialGradient>
        </Defs>
        <Circle cx={W} cy={H} r={46} fill={th.line2} stroke={th.line} strokeWidth={1.5} />
        <Circle cx={0} cy={H} r={46} fill={th.line2} stroke={th.line} strokeWidth={1.5} />
        {region ? <Path d={region} fill="url(#swFill)" /> : null}
        {region ? <Path d={region} fill="none" stroke={th.accent} strokeWidth={3} strokeLinejoin="round" /> : null}
        {showGhost ? ['right', 'left'].map((h) => (
          <React.Fragment key={h}>
            <AnimatedPath d={ghostPath(h)} fill="none" stroke={th.ink3} strokeWidth={26} strokeLinecap="round" opacity={0.25} strokeDasharray={`${GL} ${GL}`} strokeDashoffset={ghost.interpolate({ inputRange: [0, 1], outputRange: [GL, 0] }) as any} />
            <Polygon points={ghostArrow(h)} fill={th.ink3} opacity={0.45} />
          </React.Fragment>
        )) : null}
        {pts.length > 1 ? <Polyline points={pts.map((p) => U.f1(p.x) + ',' + U.f1(p.y)).join(' ')} fill="none" stroke={th.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </Svg>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, right: 20, top: 20, gap: 10 }}>
        <Text style={{ fontFamily: F.display, fontSize: 19, letterSpacing: 0.4, color: th.ink }}>GYMKDR</Text>
        <Text accessibilityRole="header" style={{ marginTop: 6, fontFamily: F.display, fontSize: 44, lineHeight: 44, color: th.ink }}>{title}</Text>
        <Text style={{ fontFamily: F.body, fontSize: 16, lineHeight: 23, color: th.ink2, maxWidth: 480 }}>{sr ? 'With VoiceOver or TalkBack on, choose your hand with the buttons below.' : text}</Text>
        {count ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
            <Svg width={30} height={30} viewBox="0 0 40 40" style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={20} cy={20} r={16} fill="none" stroke={th.line} strokeWidth={4} />
              <AnimatedCircle cx={20} cy={20} r={16} fill="none" stroke={th.ink} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${C} ${C}`} strokeDashoffset={ring.interpolate({ inputRange: [0, 1], outputRange: [C, 0] }) as any} />
            </Svg>
            <Text style={{ fontFamily: F.bodyB, fontSize: 16, color: th.ink }}>{count}</Text>
          </View>
        ) : null}
        {/* For a screen reader or a keyboard, which can't sweep */}
        <View style={sr ? { gap: 10, marginTop: 10 } : { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
          {(['right', 'left'] as const).map((h) => (
            <Pressable key={h} accessibilityRole="button" onPress={() => choose(h)} style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, backgroundColor: th.hubBg }}>
              <Text style={{ fontFamily: F.bodyB, fontSize: 17, color: th.hubInk }}>Use GYMKDR with my {h} thumb</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}
