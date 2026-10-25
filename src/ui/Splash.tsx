/* The One Thumb studio mark, the first thing every One Thumb game and app shows on a cold launch:
   the circle draws (0.7 s), the thumb rises into it (0.45–1.05 s), ONE THUMB types on (0.9–1.3 s),
   PRESENTS fades in (from 1.2 s), then everything fades (1.8–2.2 s). A tap skips it. The same mark
   and timing in every One Thumb app: a fixed black card, whatever the theme. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';
import CH from '../ch';
import { F } from './theme';

const INK = '#f2eee4';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const WORD = 'ONE THUMB'.split('');

export default function Splash({ onDone, reduced }: { onDone: () => void; reduced: boolean }) {
  const draw = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const rise = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const sub = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(reduced ? WORD.length : 0);
  const over = useRef(false);
  const finish = (fast: boolean) => {
    if (over.current) return;
    over.current = true;
    onDone();
    Animated.timing(out, { toValue: 0, duration: fast ? 180 : 400, easing: Easing.in(Easing.quad), useNativeDriver: false }).start();
  };
  useEffect(() => {
    const timers: any[] = [];
    if (!reduced) {
      Animated.timing(draw, { toValue: 1, duration: 700, easing: Easing.bezier(0.33, 1, 0.68, 1), useNativeDriver: false }).start();
      Animated.timing(rise, { toValue: 1, delay: 450, duration: 600, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: false }).start();
      Animated.timing(sub, { toValue: 1, delay: 1200, duration: 300, useNativeDriver: false }).start();
      WORD.forEach((_, i) => timers.push(setTimeout(() => setShown(i + 1), 900 + i * 44.4)));
    }
    timers.push(setTimeout(() => finish(false), reduced ? 1200 : 1800));
    return () => timers.forEach(clearTimeout);
  }, []);
  const C = 2 * Math.PI * 34;
  return (
    <Animated.View pointerEvents={over.current ? 'none' : 'auto'} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 50, opacity: out }}>
      <Pressable accessibilityRole="image" accessibilityLabel="One Thumb presents" onPressIn={() => { try { CH.sound.unlock(); } catch (e) { /* optional */ } finish(true); }}
        style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingBottom: '14%' }}>
        <Svg width={136} height={136} viewBox="0 0 120 120">
          <Defs><ClipPath id="otsClip"><Circle cx={60} cy={60} r={31} /></ClipPath></Defs>
          <AnimatedCircle cx={60} cy={60} r={34} fill="none" stroke={INK} strokeWidth={3} transform="rotate(-90 60 60)" strokeDasharray={`${C} ${C}`} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [C, 0] }) as any} />
          <G clipPath="url(#otsClip)">
            <AnimatedG translateY={rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) as any}>
              <Path d="M47 94V54a13 13 0 0 1 26 0v40" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M52 56v-6a8 8 0 0 1 16 0v6z" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M51 70h18" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
            </AnimatedG>
          </G>
        </Svg>
        <View style={{ flexDirection: 'row', marginTop: 16, paddingLeft: 5 }}>
          {WORD.map((c, i) => <Text key={i} style={{ fontFamily: F.display, fontSize: 30, lineHeight: 32, letterSpacing: 4.8, color: INK, opacity: i < shown ? 1 : 0 }}>{c === ' ' ? ' ' : c}</Text>)}
        </View>
        <Animated.Text style={{ marginTop: 12, paddingLeft: 4, fontFamily: F.bodyB, fontSize: 12, letterSpacing: 3.8, textTransform: 'uppercase', color: '#8a8478', opacity: sub }}>Presents</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}
