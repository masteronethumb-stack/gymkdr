/* GYMKDR · small observable values the React tree subscribes to. The ported logic sets them
   (which screen, its content, the Start button and rim, a toast, the name sheet), React draws them. */
import { useSyncExternalStore } from 'react';

export type Atom<T> = { get: () => T; set: (v: T) => void; sub: (f: () => void) => () => void };
export function atom<T>(v: T): Atom<T> {
  let cur = v;
  const subs = new Set<() => void>();
  return {
    get: () => cur,
    set: (n: T) => { cur = n; subs.forEach((f) => f()); },
    sub: (f) => { subs.add(f); return () => { subs.delete(f); }; },
  };
}
export function useAtom<T>(a: Atom<T>): T {
  return useSyncExternalStore(a.sub, a.get, a.get);
}

export type Hub = { label: string; sub?: string; icon?: string; primary?: boolean; warm?: boolean; off?: boolean; aria?: string; menu?: any; slide?: any; act?: () => void };
export type RimItem = { label: string; icon?: string; glyph?: string; small?: boolean; badge?: string; prio?: number; sel?: boolean; off?: boolean; accent?: boolean; aria?: string; menu?: any; act?: () => void; more?: boolean; row?: any };

export const viewAtom = atom<{ name: string | null; rev: number }>({ name: null, rev: 0 });
export const contentAtom = atom<Record<string, any>>({});
export type Geo = { W: number; H: number; hub: { x: number; y: number; d: number; a: number; r: number }; rim: { a: number; r: number; p: { x: number; y: number } }[]; b: number };
export const stageAtom = atom<{ hub: Hub | null; rim: RimItem[]; G: Geo | null; labels: ({ x: number; y: number; w: number; h: number } | null)[]; reachH: number; rev: number }>({ hub: null, rim: [], G: null, labels: [], reachH: 280, rev: 0 });
// The reach's outline, shown for a moment after a tap that landed outside it.
export const flashAtom = atom<number>(0);
export const toastAtom = atom<{ html: string; kind: string; id: number } | null>(null);
export const askAtom = atom<any>(null);
export const sweepAtom = atom<{ reason?: string; resolve: () => void } | null>(null);
export const reachTopAtom = atom<number>(280);
export const handAtom = atom<string>('right');
export const sizeAtom = atom<{ W: number; H: number; top: number; left: number }>({ W: 0, H: 0, top: 0, left: 0 });
export const scrollTopAtom = atom<number>(0);
