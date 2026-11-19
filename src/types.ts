export type St = 'r' | 'o' | 'g' | 'n';
export type Item = { i: string; n: string; e: string; a: string; l: string; w: St; wn: string; r: string; s: string };
export type Trade = { i: string; n: string; items: Item[] };
export type Loc = { i: string; n: string; g: string };
export type Project = { id: string; name: string; date: string; locs: Loc[]; trades: Trade[] };
export type Snap = { d: string; l: string; s: Record<string, string> };
export type Hist = { snaps: Snap[] };
export type Index = { list: { id: string; name: string }[]; active: string };
