/* GYMKDR · a training log on paper and slate. One accent, plate blue, only ever means "better than
   last time". Light and dark follow the phone. */
import React, { createContext, useContext } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';

export type Palette = {
  bg: string; surface: string; ink: string; ink2: string; ink3: string; line: string; line2: string;
  accent: string; accentSoft: string; warn: string; warnSoft: string; hubBg: string; hubInk: string; band: string;
  shadow: string; wash: string; scrim: string; dark: boolean;
};

export const LIGHT: Palette = {
  bg: '#f3f5f8', surface: '#ffffff', ink: '#15181d', ink2: '#454d59', ink3: '#5f6875', line: '#d6dce4', line2: '#e6eaef',
  accent: '#1d56d1', accentSoft: 'rgba(29, 86, 209, 0.11)', warn: '#9c4d00', warnSoft: 'rgba(196, 104, 0, 0.13)',
  hubBg: '#15181d', hubInk: '#f3f5f8', band: 'rgba(69, 77, 89, 0.12)',
  shadow: '0px 1px 2px rgba(21, 24, 29, 0.08), 0px 6px 18px rgba(21, 24, 29, 0.08)',
  wash: 'rgba(243, 245, 248, 0.74)', scrim: 'rgba(14, 17, 21, 0.32)', dark: false,
};
export const DARK: Palette = {
  bg: '#0e1115', surface: '#161a20', ink: '#eef0f3', ink2: '#b7bec8', ink3: '#9aa2ad', line: '#2b313a', line2: '#20252c',
  accent: '#82a8ff', accentSoft: 'rgba(130, 168, 255, 0.15)', warn: '#f0a646', warnSoft: 'rgba(240, 166, 70, 0.14)',
  hubBg: '#eef0f3', hubInk: '#0e1115', band: 'rgba(183, 190, 200, 0.12)',
  shadow: '0px 1px 2px rgba(0, 0, 0, 0.4), 0px 8px 22px rgba(0, 0, 0, 0.35)',
  wash: 'rgba(14, 17, 21, 0.74)', scrim: 'rgba(0, 0, 0, 0.5)', dark: true,
};

// Custom fonts carry their weight in the family name (fontWeight would be ignored on Android).
export const F = {
  display: 'BarlowCondensed_700Bold',
  display6: 'BarlowCondensed_600SemiBold',
  display5: 'BarlowCondensed_500Medium',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyB: 'AtkinsonHyperlegible_700Bold',
  bodyI: 'AtkinsonHyperlegible_400Regular_Italic',
};

const Ctx = createContext<Palette>(LIGHT);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return <Ctx.Provider value={scheme === 'dark' ? DARK : LIGHT}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);

// clamp(lo, vw * frac, hi): sizes that follow the screen width, as Chalk's CSS did.
export function useVw() {
  const { width } = useWindowDimensions();
  return (frac: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, width * frac));
}
