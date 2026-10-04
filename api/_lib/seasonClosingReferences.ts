import type {ClosingReferences} from './seasonResult.js';
// Owner decision 2026-10-04: retain official Friday regular-session closes.
// Last oracle observations are NOT closing prints. Keep the result pending until
// reviewed split-adjusted, dividend-excluded Sep 25 / Oct 2 closes are published here.
// This is deliberately not configurable through a request or visitor input.
export const closingReferences:ClosingReferences|null=null;
