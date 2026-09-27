// Pre-announcement placeholders only. No Season mechanics are shipped before release.
// Monday activation is an explicit release, never driven by the visitor clock.
// Kept out of config.ts so presentation changes do not alter ENGINE_VERSION.
export const WHITEPAPER_URL = "";
export const SEASON_RULES_FINAL = false;
// Guided tutorial (whitepaper v0.1 beta). While false, production builds do not include it;
// DEV and builds with VITE_SEASON_TUTORIAL=true include it for review. Flip at release.
export const SEASON_TUTORIAL_LIVE = false;
