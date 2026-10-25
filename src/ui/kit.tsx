/* GYMKDR · the reading column's type and pieces, matching Chalk's look: Barlow Condensed for
   headings and numbers, Atkinson Hyperlegible for reading. */
import React from 'react';
import { Text, View, TextStyle, ViewStyle, StyleProp } from 'react-native';
import { F, useTheme, useVw } from './theme';
import Icon from './Icon';
import CH from '../ch';

type TP = { children?: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export function T({ children, style, numberOfLines }: TP) {
  const th = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: F.body, fontSize: 16, lineHeight: 23, color: th.ink }, style]}>{children}</Text>;
}
export function B({ children, style }: TP) { return <Text style={[{ fontFamily: F.bodyB }, style]}>{children}</Text>; }

export function Topbar({ kick }: { kick?: string }) {
  const th = useTheme();
  const unsaved = CH.store && CH.store.unsaved;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="mark" size={20} color={th.ink} stroke={2.4} />
        <Text style={{ fontFamily: F.display, fontSize: 19, letterSpacing: 0.4, color: th.ink }}>GYMKDR</Text>
      </View>
      {kick ? <Text style={{ fontFamily: F.bodyB, fontSize: 13, color: th.warn }}>{kick}</Text> : null}
      <Text style={{ marginLeft: 'auto', fontFamily: unsaved ? F.bodyB : F.body, fontSize: 13, color: unsaved ? th.warn : th.ink3 }}>{unsaved ? '! Not saved' : 'On this phone'}</Text>
    </View>
  );
}
export function Kick({ children, style }: TP) {
  const th = useTheme();
  return <Text style={[{ marginTop: 18, marginBottom: 2, fontFamily: F.bodyB, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: th.ink3 }, style]}>{children}</Text>;
}
export function Title({ children, style, size }: TP & { size?: [number, number, number] }) {
  const th = useTheme(), vw = useVw();
  const fs = size ? vw(size[0], size[1], size[2]) : vw(0.11, 40, 56);
  return <Text accessibilityRole="header" style={[{ fontFamily: F.display, fontSize: fs, lineHeight: Math.round(fs * 1.0), color: th.ink }, style]}>{children}</Text>;
}
export function Meta({ children, style }: TP) {
  const th = useTheme();
  return <T style={[{ marginTop: 8, color: th.ink2 }, style]}>{children}</T>;
}
export function Sec({ children, style }: TP) {
  const th = useTheme();
  return <Text accessibilityRole="header" style={[{ fontFamily: F.display6, fontSize: 24, letterSpacing: 0.2, marginTop: 28, marginBottom: 2, color: th.ink }, style]}>{children}</Text>;
}
export function Dim({ children, style }: TP) {
  const th = useTheme();
  return <T style={[{ fontSize: 14, lineHeight: 20, color: th.ink3 }, style]}>{children}</T>;
}
export function Card({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return <View style={[{ borderRadius: 12, backgroundColor: th.surface, boxShadow: th.shadow, paddingVertical: 12, paddingHorizontal: 14 } as ViewStyle, style]}>{children}</View>;
}
// A card of plain words: an offer (a pointer to the button that does it), or how things stand.
export function Glance({ children, offer, raw, style }: { children?: React.ReactNode; offer?: boolean; raw?: boolean; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return (
    <Card style={[{ marginTop: 18 }, offer ? { borderLeftWidth: 4, borderLeftColor: th.hubBg } : null, style]}>
      {raw ? children : <T style={{ color: offer ? th.ink : th.ink2 }}>{children}</T>}
    </Card>
  );
}
export function Legend({ children }: TP) {
  const th = useTheme();
  return <T style={{ marginTop: 14, fontSize: 14, lineHeight: 20, color: th.ink2 }}>{children}</T>;
}
export function Chip({ children, kind, icon, style }: { children?: React.ReactNode; kind?: 'up' | 'warm' | 'dark' | 'raised'; icon?: string; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  const fg = kind === 'up' ? th.accent : kind === 'warm' ? th.warn : kind === 'dark' ? th.hubInk : th.ink2;
  const bg = kind === 'up' ? th.accentSoft : kind === 'warm' ? th.warnSoft : kind === 'dark' ? th.hubBg : kind === 'raised' ? th.surface : th.line2;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 99, backgroundColor: bg, alignSelf: 'center' }, kind === 'raised' ? ({ boxShadow: th.shadow } as ViewStyle) : null, style]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={{ fontFamily: F.bodyB, fontSize: 12.5, color: fg }}>{children}</Text>
    </View>
  );
}
export function WarnMark() {
  const th = useTheme();
  return <Text style={{ fontFamily: F.bodyB, fontSize: 13, color: th.warn, backgroundColor: th.warnSoft, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 6 }}>!</Text>;
}
export function Hr() { const th = useTheme(); return <View style={{ height: 1, backgroundColor: th.line }} />; }
// A list row with a line under it.
export function Line({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return <View style={[{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: th.line }, style]}>{children}</View>;
}
// A name on the left and its numbers on the right, with a line under it (a list of exercises).
export function Pair({ name, value, dim, bold = true, size = 19, style }: { name: React.ReactNode; value?: React.ReactNode; dim?: boolean; bold?: boolean; size?: number; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: th.line }, style]}>
      <Text style={{ flex: 1, minWidth: 0, fontFamily: bold && !dim ? F.bodyB : F.body, fontSize: 16, lineHeight: 22, color: dim ? th.ink3 : th.ink }}>{name}</Text>
      {value != null && value !== '' ? <Text style={{ flexShrink: 0, fontFamily: F.display6, fontSize: size, color: th.ink2, fontVariant: ['tabular-nums'] }}>{value}</Text> : null}
    </View>
  );
}
// A section heading in the display face, with anything after it (a chip) and a number at its end.
export function H2({ children, after, n, size = 26, style }: { children?: React.ReactNode; after?: React.ReactNode; n?: React.ReactNode; size?: number; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }, style]}>
      <Text accessibilityRole="header" style={{ fontFamily: F.display, fontSize: size, lineHeight: Math.round(size * 1.1), color: th.ink }}>{children}</Text>
      {after}
      {n != null && n !== '' ? <Text style={{ marginLeft: 'auto', fontFamily: F.display6, fontSize: 20, color: th.ink3, fontVariant: ['tabular-nums'] }}>{n}</Text> : null}
    </View>
  );
}
// A screen's opening: the small heading over the big one, and a line under it.
export function Head({ kick, title, meta, titleSize }: { kick?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; titleSize?: [number, number, number] }) {
  return (
    <View>
      {kick ? <Kick>{kick}</Kick> : null}
      <Title size={titleSize}>{title}</Title>
      {meta ? <Meta>{meta}</Meta> : null}
    </View>
  );
}
export function Num({ children, style, size = 21, weight = 6 }: TP & { size?: number; weight?: 5 | 6 | 7 }) {
  const th = useTheme();
  return <Text style={[{ fontFamily: weight === 7 ? F.display : weight === 5 ? F.display5 : F.display6, fontSize: size, color: th.ink, fontVariant: ['tabular-nums'] }, style]}>{children}</Text>;
}
