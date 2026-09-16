import type { Trade } from "../types";

type Handler = (t: Trade) => void;
const hs = new Set<Handler>();

export const marketBus = {
  on(h: Handler) {
    hs.add(h);
    return () => hs.delete(h);
  },
  emit(t: Trade) {
    hs.forEach((h) => h(t));
  },
};
