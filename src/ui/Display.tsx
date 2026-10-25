/* GYMKDR · the reading column. The top of the screen is for reading; it ends above the thumb's
   controls, so no words sit behind a button. Longer pages scroll inside it. */
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import CH from '../ch';
import { F, useTheme } from './theme';
import { contentAtom, stageAtom, useAtom, viewAtom } from './store';

const reduced = () => !!(CH.store && CH.store.state && CH.store.state.settings && CH.store.state.settings.motion === 'reduced');

export default function Display() {
  const th = useTheme();
  const c = useAtom(contentAtom);
  const v = useAtom(viewAtom);
  const { reachH } = useAtom(stageAtom);
  const ref = useRef<ScrollView>(null);
  const dx = useRef(new Animated.Value(0)).current;
  // A new screen starts at its top.
  useEffect(() => { if (ref.current) ref.current.scrollTo({ y: 0, animated: false }); }, [v.rev]);
  // Swiping to another exercise slides the new one in from that side.
  useEffect(() => {
    if (!c.enterId || reduced()) return;
    dx.setValue(c.enter || 0);
    Animated.timing(dx, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [c.enterId]);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: reachH }}>
      <ScrollView
        ref={ref}
        testID="display"
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, flexGrow: 1 }}
      >
        <Animated.View style={{ width: '100%', maxWidth: 576, alignSelf: 'center', flexGrow: 1, transform: [{ translateX: dx }] }}>
          {c.el || (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 120 }}>
              <Text style={{ fontFamily: F.body, fontSize: 16, color: th.ink3 }}>Warming up…</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
