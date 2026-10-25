/* GYMKDR · a short note at the top of the screen (saved, renamed, a new best), then it goes. */
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import CH from '../ch';
import { RichLine, plain } from './Rich';
import { F, useTheme } from './theme';
import { toastAtom, useAtom } from './store';

let seq = 0;
let timer: any = 0;
/* toast(html, kind): a snippet of inline HTML (bold, icons via CH.icon); kind 'pr' for a new best.
   The wheel's own notes come as { icon, text }. */
export function toast(x: any, kind = '') {
  const html = typeof x === 'string' ? x : `${x.icon ? CH.icon(x.icon) : ''}<span>${CH.u.esc(x.text || '')}</span>`;
  toastAtom.set({ html, kind, id: ++seq });
  CH.lastToast = { html, kind, at: Date.now() };
  clearTimeout(timer);
  timer = setTimeout(() => { const t = toastAtom.get(); if (t && t.id === seq) toastAtom.set(null); }, kind === 'pr' ? 2600 : 2000);
}

export default function Toast() {
  const th = useTheme();
  const t = useAtom(toastAtom);
  const op = useRef(new Animated.Value(0)).current;
  const last = useRef<any>(null);
  if (t) last.current = t;
  useEffect(() => {
    Animated.timing(op, { toValue: t ? 1 : 0, duration: t ? 160 : 220, useNativeDriver: false }).start();
  }, [t && t.id, !!t]);
  const cur = t || last.current;
  if (!cur) return null;
  const pr = cur.kind === 'pr';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: 12, alignItems: 'center', zIndex: 12 }}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityLabel={plain(cur.html)}
        style={{
          opacity: op, transform: [{ translateY: op.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, backgroundColor: pr ? th.accent : th.hubBg, boxShadow: th.shadow, maxWidth: '100%',
        } as any}
      >
        <RichLine html={cur.html} style={{ fontFamily: F.bodyB, fontSize: 15, lineHeight: 20, color: pr ? th.bg : th.hubInk }} />
      </Animated.View>
    </View>
  );
}
