/* GYMKDR · icons. One stroke family on a 24-point grid, always shown with a text label.
   Arrows keep their meaning when hands swap (back still points back). */
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import CH from '../ch';

export const PATHS: Record<string, string> = {
  check: 'M4.5 12.5l5 5 10-11',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  today: 'M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12',
  progress: 'M4 4.5V19.5h16M7.5 15l4-4.5 3 3 5-6',
  week: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v4.5M15.5 3.5v4.5',
  plan: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  back: 'M19 12H6M11 6.5 5.5 12l5.5 5.5',
  next: 'M5 12h13M13 6.5l5.5 5.5-5.5 5.5',
  undo: 'M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3',
  swap: 'M5 8.5h13.5L15 5M19 15.5H5.5L9 19',
  timer: 'M12 21a7.5 7.5 0 1 0 0-15a7.5 7.5 0 1 0 0 15M12 10v3.8l2.4 1.4M9.5 3h5',
  flag: 'M5.5 21V4M5.5 4.5h11l-2.5 4 2.5 4h-11',
  sweep: 'M20 20A16 16 0 0 0 4 4M20 20a9 9 0 0 0-9-9M20 20h.01',
  upload: 'M12 15V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14',
  download: 'M12 4.5V15M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  play: 'M8 5.5v13l10.5-6.5z',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  warm: 'M12 20.5c-3.4 0-5.8-2.3-5.8-5.6 0-3.2 2.7-5 3.7-8.4 2.1 1.5 2.9 3.5 2.9 5.3 1-.7 1.6-1.7 1.9-2.9 1.5 1.5 3.1 3.7 3.1 6 0 3.3-2.4 5.6-5.8 5.6z',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z',
  sound: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10',
  haptics: 'M9 4h6v16H9zM5 8.5v7M19 8.5v7M2.5 10.5v3M21.5 10.5v3',
  motion: 'M3.5 12c2.5-6 5.5 6 8.5 0s6 6 8.5 0',
  body: 'M12 3.5a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4M6 10l6 1.5 6-1.5M12 11.5v4M9 21l3-5.5 3 5.5',
  plate: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 11v5.5M12 7.8v.4',
  light: 'M5 19h14M7 15h10M9 11h6',
  edit: 'M5 19l1-4.2L15.6 5.2l3.2 3.2L9.2 18zM13.4 7.4l3.2 3.2',
  stack: 'M12 4.5l8 4-8 4-8-4zM4 12.5l8 4 8-4M4 16.5l8 4 8-4',
  mic: 'M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3',
  mark: 'M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12',
};
const FILLED = new Set(['play', 'star']);

export default function Icon({ name, size = 22, color = '#000', stroke = 2, fill }: { name: string; size?: number; color?: string; stroke?: number; fill?: boolean }) {
  const d = PATHS[name] || PATHS.info;
  const filled = fill ?? FILLED.has(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={d} fill={filled ? color : 'none'} stroke={filled && name === 'play' ? 'none' : color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* Code ported from Chalk puts icons into short HTML snippets (a toast, a chip). CH.icon gives a
   marker that ui/Rich draws as an Icon. */
CH.icon = (name: string) => `⟦icon:${name}⟧`;
