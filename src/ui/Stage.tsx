/* GYMKDR · the thumb's corner: the hub (Start), the rim buttons on their arc, and their labels.
   Positions come from logic/stage.js; touches go to the thumb wheel (logic/wheel.js).
   Every control is a real button for VoiceOver and TalkBack too. */
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { Animated, Easing, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import CH from '../ch';
import Icon from './Icon';
import { F, useTheme } from './theme';
import { flashAtom, handAtom, stageAtom, useAtom } from './store';
import { alpha, appPoint, touch } from './geo';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const reduced = () => !!(CH.store && CH.store.state && CH.store.state.settings && CH.store.state.settings.motion === 'reduced');

export function useWheel() {
  useSyncExternalStore(CH.scrub.subscribe, CH.scrub.version, CH.scrub.version);
  return CH.scrub.snapshot();
}

function Hub() {
  const th = useTheme();
  const st = useAtom(stageAtom);
  const hand = useAtom(handAtom);
  const w = useWheel();
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const g = useRef<{ mode: string; start?: { x: number; y: number }; far?: boolean; h?: any }>({ mode: '' });
  const popRef = useRef(0);

  // Choosing Back (or going home) pops the button.
  useEffect(() => {
    if (!w || w.popAt === popRef.current) return;
    popRef.current = w.popAt;
    if (reduced()) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.12, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(scale, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [w && w.popAt]);
  // Holding still inside a menu that came from another: a ring fills, then back to the first menu.
  const homing = !!(w && w.homing);
  useEffect(() => {
    ring.stopAnimation();
    ring.setValue(0);
    if (homing) Animated.timing(ring, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: false }).start();
  }, [homing]);

  const G = st.G;
  if (!G) return null;
  const h = st.hub;
  if (!h && !w) return null;
  const d = G.hub.d;
  const anchor = !!w;
  const compact = d < 88, tiny = d < 60;
  const off = Math.round(d * 0.08);
  const dx = hand === 'right' ? -off : off;
  const primary = anchor || (h && h.primary);
  const bg = anchor || primary ? th.hubBg : h && h.warm ? th.warn : th.surface;
  const fg = anchor || primary || (h && h.warm) ? th.hubInk : th.ink;

  const pressFx = () => {
    if (reduced()) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 60, useNativeDriver: false }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: false }),
    ]).start();
  };
  const act = (hh: any) => { pressFx(); CH.sound.unlock(); hh.act && hh.act(); };

  const handlers = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: any) => {
      touch.onControl = true;
      const p = appPoint(e);
      const cur = stageAtom.get().hub;
      g.current = { mode: '', start: p, far: false, h: cur };
      // While a wheel is open the hub belongs to it: a tap commits, a slide rolls it.
      if (CH.scrub.isOpen()) { g.current.mode = 'wheel'; CH.scrub.press(null, p, true); return; }
      if (!cur || cur.off) return;
      // A hub with a wheel as well as an action (Done: tap to log the target, slide for other reps):
      // nothing opens until the thumb slides.
      if (cur.slide && !cur.menu) { g.current.mode = 'slide'; return; }
      if (cur.menu) { g.current.mode = 'wheel'; CH.scrub.press(cur.menu, p, true); return; }
      g.current.mode = 'tap';
    },
    onResponderMove: (e: any) => {
      const p = appPoint(e), s = g.current;
      if (s.start && Math.hypot(p.x - s.start.x, p.y - s.start.y) > 20) s.far = true;
      if (s.mode === 'wheel') CH.scrub.move(p);
      else if (s.mode === 'slide' && s.h && CH.scrub.slideMove(s.h.slide, s.start, p)) s.mode = 'wheel';
    },
    onResponderRelease: () => {
      const s = g.current;
      g.current = { mode: '' };
      if (s.mode === 'wheel') { CH.scrub.up(); return; }
      // A drag that went sideways isn't a tap: it doesn't act.
      if ((s.mode === 'slide' || s.mode === 'tap') && !s.far && s.h) act(s.h);
    },
    onResponderTerminate: () => {
      const s = g.current;
      g.current = { mode: '' };
      if (s.mode === 'wheel') CH.scrub.cancel();
    },
  };

  // What a screen reader hears, and what its gestures do.
  let label = h ? h.aria || [h.label, h.sub].filter(Boolean).join(', ') : '';
  const o = w && w.opts[w.idx];
  if (w && o) label = `${o.label}${o.sub ? ', ' + o.sub : ''}. ${w.idx + 1} of ${w.opts.length}. Double-tap to choose`;
  const a11y = {
    accessible: true,
    accessibilityRole: (w ? 'adjustable' : 'button') as any,
    accessibilityLabel: label,
    accessibilityHint: !w && h && h.menu ? 'Opens its choices' : undefined,
    accessibilityState: { disabled: !w && !!(h && h.off), expanded: w ? true : h && h.menu ? false : undefined },
    accessibilityActions: w ? [{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }] : [{ name: 'activate' }],
    onAccessibilityAction: (ev: any) => {
      const n = ev.nativeEvent.actionName;
      if (n === 'increment') CH.scrub.nudge(1);
      else if (n === 'decrement') CH.scrub.nudge(-1);
      else if (n === 'activate') {
        if (CH.scrub.isOpen()) CH.scrub.click(null);
        else if (h && !h.off) { if (h.menu) CH.scrub.click(h.menu); else act(h); }
      }
    },
  };

  const ringR = d / 2 + 7;
  const C = 2 * Math.PI * ringR;
  const box: ViewStyle = {
    position: 'absolute', left: G.hub.x - d / 2, top: G.hub.y - d / 2, width: d, height: d, borderRadius: d / 2,
    backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: !anchor && h && h.off ? 0.45 : 1,
    boxShadow: anchor && w.armed ? `0px 0px 0px 6px ${alpha(th.hubBg, 0.28)}, ${th.shadow}` : th.shadow,
    zIndex: 6,
  } as any;
  const tapWord = !!w && (w.armed || !w.dragging);
  return (
    <Animated.View testID="hub" {...a11y} {...handlers} style={[box, { transform: [{ scale }] }]}>
      {homing ? (
        <Svg pointerEvents="none" width={d + 18} height={d + 18} style={{ position: 'absolute', left: -9, top: -9, transform: [{ rotate: '-90deg' }] }}>
          <AnimatedCircle cx={(d + 18) / 2} cy={(d + 18) / 2} r={ringR} stroke={th.ink} strokeWidth={4} fill="none" strokeDasharray={`${C} ${C}`} strokeDashoffset={ring.interpolate({ inputRange: [0, 1], outputRange: [C, 0] }) as any} />
        </Svg>
      ) : null}
      <View pointerEvents="none" style={{ alignItems: 'center', gap: 1, transform: [{ translateX: tiny ? 0 : dx }, { translateY: tiny ? 0 : -off }] }}>
        {anchor ? (
          tapWord ? <Text style={{ fontFamily: F.bodyB, fontSize: 17, letterSpacing: 1, textTransform: 'uppercase', color: fg }}>Tap</Text> : null
        ) : h ? (
          <>
            {h.icon && !compact ? <Icon name={h.icon} size={26} color={fg} stroke={2.4} /> : null}
            <Text numberOfLines={tiny ? 1 : 3} style={{ maxWidth: tiny ? d - 6 : d - 18, fontFamily: F.bodyB, fontSize: tiny ? 13 : compact ? 16 : 18, lineHeight: Math.round((tiny ? 13 : compact ? 16 : 18) * 1.05), textAlign: 'center', color: fg }}>{h.label}</Text>
            {h.sub && !tiny ? <Text numberOfLines={1} style={{ maxWidth: d - 16, fontFamily: F.display6, fontSize: compact ? 16 : 18, lineHeight: 19, color: fg, opacity: 0.85, fontVariant: ['tabular-nums'] }}>{h.sub}</Text> : null}
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

function RimButton({ r, i }: { r: any; i: number }) {
  const th = useTheme();
  const st = useAtom(stageAtom);
  const w = useWheel();
  const scale = useRef(new Animated.Value(1)).current;
  const g = useRef<{ mode: string; start?: { x: number; y: number }; far?: boolean }>({ mode: '' });
  const G = st.G;
  if (!G || !G.rim[i]) return null;
  const q = G.rim[i], b = G.b;
  const fx = () => {
    if (reduced()) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 60, useNativeDriver: false }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: false }),
    ]).start();
  };
  const tap = () => { if (r.off) return; fx(); CH.haptic('select'); CH.sound.unlock(); r.act && r.act(); };
  // While a wheel is open the rim steps back (it stays in place, so a press that opened the wheel
  // from here keeps rolling it).
  const hidden = !!w;
  const handlers = {
    onStartShouldSetResponder: () => !r.off && !CH.scrub.isOpen(),
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: any) => {
      touch.onControl = true;
      const p = appPoint(e);
      g.current = { mode: r.menu ? 'wheel' : 'tap', start: p, far: false };
      // A rim button with a menu hands its choices to the hub; the thumb slides from where it is.
      if (r.menu) CH.scrub.press(r.menu, p, false);
    },
    onResponderMove: (e: any) => {
      const p = appPoint(e), s = g.current;
      if (s.start && Math.hypot(p.x - s.start.x, p.y - s.start.y) > 24) s.far = true;
      if (s.mode === 'wheel') CH.scrub.move(p);
    },
    onResponderRelease: () => {
      const s = g.current;
      g.current = { mode: '' };
      if (s.mode === 'wheel') { CH.scrub.up(); return; }
      if (s.mode === 'tap' && !s.far) tap();
    },
    onResponderTerminate: () => { const s = g.current; g.current = { mode: '' }; if (s.mode === 'wheel') CH.scrub.cancel(); },
  };
  const sel = !!r.sel;
  const fg = sel ? th.hubInk : th.ink;
  return (
    <Animated.View
      testID={'rim-' + (r.label || i)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={r.aria || r.label}
      accessibilityState={{ disabled: !!r.off, selected: sel, expanded: r.menu ? false : undefined }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => { if (r.off) return; if (r.menu) CH.scrub.click(r.menu); else tap(); }}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}
      {...handlers}
      style={[{
        position: 'absolute', left: q.p.x - b / 2, top: q.p.y - b / 2, width: b, height: b, borderRadius: b / 2,
        borderWidth: 1.5, borderColor: sel ? th.hubBg : th.line, backgroundColor: sel ? th.hubBg : th.surface,
        alignItems: 'center', justifyContent: 'center', boxShadow: th.shadow, opacity: hidden ? 0 : r.off ? 0.4 : 1,
      } as any, { transform: [{ scale }] }]}
    >
      {r.glyph ? <Text style={{ fontFamily: F.display, fontSize: r.small ? 18 : 24, lineHeight: r.small ? 20 : 26, color: fg, fontVariant: ['tabular-nums'] }}>{r.glyph}</Text> : <Icon name={r.icon || 'info'} size={24} color={fg} />}
      {r.badge ? (
        <View style={{ position: 'absolute', right: -4, top: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: th.warn, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.bodyB, fontSize: 12, color: th.hubInk }}>{r.badge}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function Labels() {
  const th = useTheme();
  const st = useAtom(stageAtom);
  const w = useWheel();
  if (!st.G || w) return null;
  return (
    <>
      {st.rim.map((r: any, i: number) => {
        const l = st.labels[i];
        if (!l || !r.label) return null;
        return (
          <View key={'l' + i} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: l.x, top: l.y, width: l.w, height: l.h, borderRadius: 6, backgroundColor: alpha(th.bg, 0.82), alignItems: 'center', justifyContent: 'center' }}>
            <Text numberOfLines={1} style={{ fontFamily: F.bodyB, fontSize: 13.5, color: r.sel ? th.ink : th.ink2 }}>{r.label}</Text>
          </View>
        );
      })}
    </>
  );
}

// A tap outside the reach isn't silently dropped: the boundary shows briefly.
function ReachFlash() {
  const th = useTheme();
  const n = useAtom(flashAtom);
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!n) return;
    op.setValue(0);
    Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 160, useNativeDriver: false }),
      Animated.delay(800),
      Animated.timing(op, { toValue: 0, duration: 260, useNativeDriver: false }),
    ]).start();
  }, [n]);
  if (!n) return null;
  const { W, H } = CH.reach.size();
  const d = CH.reach.path();
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: op, zIndex: 8 }}>
      <Svg width={W} height={H}>
        <Path d={d} fill={th.accentSoft} />
        <Path d={d} fill="none" stroke={th.accent} strokeWidth={2.5} strokeDasharray="7 6" />
      </Svg>
    </Animated.View>
  );
}

// The rim and its labels sit under the wheel; the hub sits on top of it (see App).
export function Rim() {
  const st = useAtom(stageAtom);
  return (
    <>
      <Labels />
      {st.rim.map((r: any, i: number) => <RimButton key={'r' + i} r={r} i={i} />)}
    </>
  );
}
export { Hub, ReachFlash };
