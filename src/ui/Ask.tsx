/* GYMKDR · typing a name: a sheet at the bottom with the field, Save on the thumb's side and Cancel
   beside it. The keyboard's own Done key saves too, and the sheet rides above the keyboard. The
   keyboard's microphone lets you say it instead. Save and Cancel are cut to the reach: their far end
   stays inside the measured arc. */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import CH from '../ch';
import Icon from './Icon';
import { F, useTheme } from './theme';
import { askAtom, handAtom, sizeAtom, useAtom } from './store';
import { touch } from './geo';

export type AskOpts = { title: string; value?: string; max?: number; placeholder?: string; mic?: boolean; done: (v: string) => void; cancel?: () => void };

export function askText(o: AskOpts) {
  CH.stage.closeList();
  askAtom.set(o);
}

export default function Ask() {
  const th = useTheme();
  const o = useAtom(askAtom) as AskOpts | null;
  const hand = useAtom(handAtom);
  const { W } = useAtom(sizeAtom);
  const [v, setV] = useState('');
  const [rowW, setRowW] = useState<number | null>(null);
  const inp = useRef<TextInput>(null);
  useEffect(() => { if (o) { setV(o.value || ''); setTimeout(() => inp.current && inp.current.focus(), 60); } }, [o]);
  if (!o) return null;
  const max = o.max || 40;
  const close = (save: boolean) => {
    // Typed or spoken, a name is never longer than the field allows.
    const val = v.replace(/\s+/g, ' ').trim().slice(0, max);
    askAtom.set(null);
    if (inp.current) inp.current.blur();
    if (save) o.done(val); else if (o.cancel) o.cancel();
  };
  /* The button row is cut to the reach: its far end stays 10 pt inside the measured arc at the
     height it sits (roughly the bottom of the sheet above the keyboard, so this is a fair guess). */
  let far = W;
  const h = 70;
  for (let x = Math.round(W); x > 0; x -= 2) {
    const ang = (Math.atan2(h, x) * 180) / Math.PI;
    if (Math.hypot(x, h) <= CH.reach.R(ang) - 10) { far = x; break; }
  }
  const avail = Math.max(124, far - 12);
  const narrow = rowW != null && avail < Math.min(rowW, 220);
  const left = hand === 'left';
  const btn = (ok: boolean) => (
    <Pressable
      key={ok ? 'ok' : 'no'}
      accessibilityRole="button"
      accessibilityLabel={ok ? 'Save' : 'Cancel'}
      onPressIn={() => { touch.onControl = true; }}
      onPress={() => close(ok)}
      style={{ flex: 1, minHeight: 58, borderRadius: 16, flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: narrow ? 2 : 8, backgroundColor: ok ? th.hubBg : th.surface, borderWidth: ok ? 0 : 1.5, borderColor: th.line }}
    >
      <Icon name={ok ? 'check' : 'back'} size={narrow ? 20 : 22} color={ok ? th.hubInk : th.ink} />
      <Text style={{ fontFamily: F.bodyB, fontSize: narrow ? 14 : 17, color: ok ? th.hubInk : th.ink }}>{ok ? 'Save' : 'Cancel'}</Text>
    </Pressable>
  );
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 20 }}>
      <Pressable accessibilityLabel="Cancel" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: th.scrim }} onPressIn={() => { touch.onControl = true; }} onPress={() => close(false)} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={{ margin: 12, gap: 12, padding: 16, borderRadius: 20, backgroundColor: th.surface, boxShadow: th.shadow, maxWidth: 576, alignSelf: 'center', width: '94%' } as any}>
          <Text style={{ fontFamily: F.display, fontSize: 26, lineHeight: 28, color: th.ink, textAlign: left ? 'right' : 'left' }}>{o.title}</Text>
          {o.mic ? <Text style={{ marginTop: -6, fontFamily: F.body, fontSize: 14, color: th.ink3, textAlign: left ? 'right' : 'left' }}>Type it, or tap the microphone on your keyboard and say it.</Text> : null}
          <TextInput
            ref={inp}
            testID="ask-input"
            value={v}
            onChangeText={setV}
            maxLength={max}
            placeholder={o.placeholder || ''}
            placeholderTextColor={th.ink3}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            selectTextOnFocus
            onSubmitEditing={() => close(true)}
            onPressIn={() => { touch.onControl = true; }}
            accessibilityLabel={o.title}
            style={{ minHeight: 56, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: th.line, backgroundColor: th.bg, color: th.ink, fontFamily: F.bodyB, fontSize: 20 }}
          />
          <View onLayout={(e) => { if (rowW == null) setRowW(e.nativeEvent.layout.width); }} style={{ flexDirection: left ? 'row' : 'row-reverse', gap: 8, width: '100%', maxWidth: rowW != null && avail < rowW ? avail : undefined, alignSelf: left ? 'flex-start' : 'flex-end' }}>
            {btn(true)}
            {btn(false)}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
