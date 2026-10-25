/* GYMKDR · the thumb wheel, drawn. The choices rise in a column above the Start button on the
   thumb's side; the lit one (black) is always the middle slot. The reading runs down the other side:
   what the menu is, the lit choice's name, a line about it and its description, fitted so nothing
   is cut off. A quick wheel in a workout (reps, a weight) keeps the workout in view behind a wash.
   The state lives in logic/wheel.js; this draws it and hands it the thumb's touches. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import CH from '../ch';
import Icon from './Icon';
import Rich, { plain } from './Rich';
import { F, useTheme, useVw } from './theme';
import { useWheel } from './Stage';
import { appPoint, touch } from './geo';
import { sizeAtom, useAtom } from './store';

const reduced = () => !!(CH.store && CH.store.state && CH.store.state.settings && CH.store.state.settings.motion === 'reduced');

// The steps the description goes through until it fits: smaller, then without the optional detail,
// then smaller again; a list that still won't fit keeps what it can and says how many more.
const STEPS = [{ fit: 1, hide: false }, { fit: 0.94, hide: false }, { fit: 0.88, hide: false }, { fit: 0.88, hide: true }, { fit: 0.82, hide: true }];
const countItems = (html: string) => (String(html || '').match(/<li[\s>]/g) || []).length;

function Info({ w }: { w: any }) {
  const th = useTheme();
  const vw = useVw();
  const V = w.V;
  const o = w.opts[w.idx];
  const spec = w.spec;
  const [step, setStep] = useState(0);
  const [cut, setCut] = useState<number | null>(null);
  const [hintH, setHintH] = useState(0);
  const key = `${spec.title}|${w.idx}|${o && o.label}`;
  useEffect(() => { setStep(0); setCut(null); }, [key]);
  if (!o || spec.compact) return null;
  const avail = Math.max(0, Math.min(V.infoH, V.hintBottom - hintH - 10 - 40));
  const s = STEPS[Math.min(step, STEPS.length - 1)];
  const fit = s.fit;
  const onLayout = (e: any) => {
    const h = e.nativeEvent.layout.height;
    if (h <= avail + 1) return;
    if (step < STEPS.length - 1) { setStep(step + 1); return; }
    const n = countItems(o.info);
    const next = cut == null ? n - 1 : cut - 1;
    if (n > 1 && next >= 1) setCut(next);
  };
  const big = spec.big && o.big;
  let bigSize = Math.min(176, Math.max(120, vw(0.38, 120, 176)));
  if (big) {
    // The number is as big as the reading side allows.
    const chars = String(o.big.n).length || 1;
    bigSize = Math.floor(Math.min(bigSize, V.infoW / (chars * 0.5)));
  }
  const titleSize = Math.round(vw(0.084, 28, 36) * fit);
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left: V.infoL, top: 40, width: V.infoW, height: avail, overflow: 'hidden' }}>
        <View onLayout={onLayout} accessibilityLiveRegion="polite">
          <Text style={{ fontFamily: F.bodyB, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: th.ink3 }}>{spec.title || ''}</Text>
          {big ? (
            <View style={{ marginTop: 4, alignItems: 'flex-start', gap: 4 }}>
              <Text numberOfLines={1} style={{ fontFamily: F.display, fontSize: bigSize, lineHeight: Math.round(bigSize * 0.92), color: th.ink, fontVariant: ['tabular-nums'] }}>{o.big.n}</Text>
              <Text style={{ fontFamily: F.display, fontSize: 30, lineHeight: 32, color: th.ink2 }}>{o.big.u}</Text>
            </View>
          ) : (
            <Text accessibilityRole="header" style={{ marginTop: 2, fontFamily: F.display, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.02), color: th.ink }}>{o.title || o.label}</Text>
          )}
          {o.sub ? <Text style={{ marginTop: 6, fontFamily: spec.big ? F.bodyB : F.body, fontSize: spec.big ? 22 : Math.round(15 * fit), lineHeight: Math.round((spec.big ? 22 : 15 * fit) * 1.3), color: th.ink2 }}>{o.sub}</Text> : null}
          {o.info ? <View style={{ marginTop: 10 }}><Rich html={o.info} size={14.5} scale={fit} hideOpt={s.hide} maxItems={cut} /></View> : null}
        </View>
      </View>
      <Hint w={w} onHeight={setHintH} />
    </>
  );
}

/* Above the wheel: how many choices there are and whether more are out of view; or, while the
   lifter is still learning, what to do next in plain words. */
function Hint({ w, onHeight }: { w: any; onHeight?: (h: number) => void }) {
  const th = useTheme();
  const { H } = useAtom(sizeAtom);
  const V = w.V, hint = w.hint;
  if (!hint || !hint.text) return null;
  const bottom = Math.max(0, H - V.hintBottom);
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onLayout={(e) => onHeight && onHeight(e.nativeEvent.layout.height)}
      style={[{ position: 'absolute', left: V.infoL, width: V.infoW, bottom }, hint.coach ? ({ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: th.surface, borderWidth: 1.5, borderColor: th.hubBg, boxShadow: th.shadow } as any) : null]}>
      <Text style={{ fontFamily: hint.coach ? F.bodyB : F.bodyB, fontSize: hint.coach ? 14.5 : 13, lineHeight: hint.coach ? 19 : 17, color: hint.coach ? th.ink : th.ink2 }}>{hint.text}</Text>
    </View>
  );
}

/* A quick wheel can bring its own reading (the Calendar's dates bring the picked day's week and
   what was done that day), on a plain card so it reads clearly over the washed-out screen. */
function Panel({ w }: { w: any }) {
  const th = useTheme();
  const V = w.V, o = w.opts[w.idx];
  if (!w.spec.panel || !o) return null;
  const el = w.spec.panel(o);
  if (!el) return null;
  const h = Math.max(0, V.hintBottom - 40 - 64);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: V.infoL - 8, top: 32, width: V.infoW + 16, height: h, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 14, backgroundColor: th.bg }}>
      {el}
    </View>
  );
}

function Row({ row, w, rise }: { row: any; w: any; rise: Animated.Value }) {
  const th = useTheme();
  const V = w.V, SLOT = w.slot, o = row.o;
  if (row.void) return null;
  const on = row.on, empty = row.empty;
  const fg = on ? th.hubInk : o && o.danger ? th.warn : empty ? th.ink : th.ink2;
  const big = w.spec.big && o && o.big && !row.nav;
  const label = row.chip;
  const navIcon = row.nav ? (o.icon === 'close' ? 'close' : o.icon === 'check' ? 'check' : 'back') : null;
  const h = w.spec.compact ? 1 : (w.rows.length - 1) / 2;
  const delay = (row.d + h) * 22;
  const style: any = {
    position: 'absolute', left: V.colL, top: row.top, width: V.colW, height: SLOT, borderRadius: 12,
    borderWidth: 1.5, borderStyle: empty ? 'dashed' : 'solid',
    borderColor: on ? th.hubBg : o && o.accent ? th.ink : th.line,
    backgroundColor: on ? th.hubBg : empty ? 'transparent' : th.surface,
    opacity: empty ? 0.5 : o && o.off ? 0.45 : 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: row.nav || big ? 'flex-start' : 'space-between', gap: row.nav ? 10 : 8,
    paddingLeft: big ? 14 : 16, paddingRight: big ? 12 : 16,
  };
  const anim = {
    opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };
  return (
    <Animated.View
      testID={o ? 'wheel-row' : undefined}
      accessible={!!o}
      accessibilityRole="button"
      accessibilityLabel={o ? `${o.label}${o.sub ? ', ' + o.sub : ''}${o.value != null && o.value !== '' ? ', ' + o.value : ''}` : undefined}
      accessibilityState={{ selected: on, disabled: !!(o && o.off) }}
      accessibilityActions={o ? [{ name: 'activate' }] : undefined}
      onAccessibilityAction={() => { if (o && !o.off) CH.scrub.pickRow(row.k); }}
      importantForAccessibility={o ? 'yes' : 'no-hide-descendants'}
      style={[style, w.how === 'open' && delay >= 0 ? (anim as any) : null]}
    >
      {row.lineAbove ? <View style={{ position: 'absolute', left: 10, right: 10, top: -7.5, height: 2, borderRadius: 1, backgroundColor: th.ink3, opacity: 0.55 }} /> : null}
      {row.lineBelow ? <View style={{ position: 'absolute', left: 10, right: 10, bottom: -7.5, height: 2, borderRadius: 1, backgroundColor: th.ink3, opacity: 0.55 }} /> : null}
      {o ? (
        big ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontFamily: F.display, fontSize: 34, lineHeight: 36, color: fg, fontVariant: ['tabular-nums'] }}>{o.big.n}</Text>
            <Text style={{ fontFamily: F.bodyB, fontSize: 15, color: fg, opacity: 0.8 }}>{o.big.u}</Text>
          </View>
        ) : (
          <>
            {navIcon ? <Icon name={navIcon} size={24} color={fg} stroke={3} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={{ fontFamily: row.nav ? F.bodyB : F.body, fontSize: label.length > 20 ? 15 : 17, lineHeight: Math.round((label.length > 20 ? 15 : 17) * 1.15), color: fg }}>{label}</Text>
            </View>
            {o.value != null && o.value !== '' && !row.nav ? <Text style={{ fontFamily: F.display, fontSize: 20, color: fg }}>{String(o.value)}</Text> : null}
          </>
        )
      ) : null}
    </Animated.View>
  );
}

export default function Wheel() {
  const th = useTheme();
  const w = useWheel();
  const rise = useRef(new Animated.Value(1)).current;
  const openKey = w ? `${w.spec.title}|${w.opts.length}|${w.stackDepth}` : '';
  const g = useRef<{ on: boolean }>({ on: false });
  useEffect(() => {
    if (!w) return;
    if (reduced()) { rise.setValue(1); return; }
    rise.setValue(0);
    Animated.timing(rise, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [openKey]);
  if (!w) return null;
  const V = w.V;
  // Which choice is under a point, if any.
  const rowAt = (p: { x: number; y: number }) => {
    if (p.x < V.colL - 6 || p.x > V.colL + V.colW + 6) return null;
    const r = w.rows.find((x: any) => x.o && p.y >= x.top - 4 && p.y <= x.top + w.slot + 4);
    return r ? r.k : null;
  };
  const handlers = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: any) => {
      touch.onControl = true;
      const p = appPoint(e);
      g.current.on = true;
      CH.scrub.overlayDown(p, rowAt(p));
    },
    onResponderMove: (e: any) => { if (g.current.on) CH.scrub.move(appPoint(e)); },
    onResponderRelease: () => { if (!g.current.on) return; g.current.on = false; CH.scrub.up(); },
    onResponderTerminate: () => { if (!g.current.on) return; g.current.on = false; CH.scrub.cancel(); },
  };
  const o = w.opts[w.idx];
  return (
    <View
      testID="wheel"
      accessibilityViewIsModal
      accessibilityLabel={w.spec.title || 'Choices'}
      onAccessibilityEscape={() => CH.scrub.close()}
      {...handlers}
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 5, backgroundColor: w.spec.compact ? th.wash : th.bg }}
    >
      {w.spec.compact ? <><Panel w={w} /><Hint w={w} /></> : <Info w={w} />}
      {w.rows.map((row: any) => <Row key={'k' + row.d} row={row} w={w} rise={rise} />)}
      {/* For a screen reader: the choice that's lit, and how to choose it */}
      <Text style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} accessibilityLiveRegion="polite">{o ? `${plain(o.label)}${o.sub ? ', ' + o.sub : ''}` : ''}</Text>
    </View>
  );
}
