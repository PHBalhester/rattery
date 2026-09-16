import type { Trade, TradeSide } from "../types";

export type { Trade, TradeSide };

// Which source is currently feeding the colony.
export type FeedStatus = "idle" | "demo" | "connecting" | "catchup" | "live" | "error" | "history-limit";
