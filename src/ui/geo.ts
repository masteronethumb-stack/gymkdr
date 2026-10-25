/* GYMKDR · touch points in the app's own box (the screen inside the safe area). */
import { GestureResponderEvent } from 'react-native';
import { sizeAtom } from './store';

export function appPoint(e: GestureResponderEvent | any) {
  const n = e.nativeEvent || e;
  const s = sizeAtom.get();
  return { x: (n.pageX ?? 0) - s.left, y: (n.pageY ?? 0) - s.top };
}

// '#15181d' + 0.28 → 'rgba(21, 24, 29, 0.28)'
export function alpha(hex: string, a: number) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
}

/* Set when a control (the hub, a rim button, the wheel) takes a touch, so the hand watcher knows
   a tap outside the reach landed on something and doesn't flash the reach. */
export const touch = { onControl: false };
