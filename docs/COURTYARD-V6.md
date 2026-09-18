# Courtyard and shared dens — engine v6

An additive front courtyard connects to the nest, preserving existing chamber and tunnel coordinates. Three open-ended shelters each reserve six resting slots. Reservations count animals travelling to the shelter, expire after 1.5 simulation days, and are released for social encounters, caregiving, panic, thirst or low energy. Positive affinity increases preference; a rival below -0.35 affinity excludes a den. Resting slots are a behavioral capacity, not an invisible barrier preventing incidental entry.

The courtyard has its own ecological zone (capacity 28). Only animals physically inside a shelter count toward that shelter's local density. Drinking remains restricted to existing resource locations; thirsty animals leave the courtyard for them. Local density still affects stress independently of overall population.

Global crowding pressure begins above 70 residents, reaches two thirds at 90 and its maximum at 100. Birth capacity is 110. These are simulation balance choices, not biological measurements or a promise that all populations remain healthy. Congestion affects simulated movement, not the application's update rate.

Navigation uses the same floor circles and side-wall geometry as rendering. Den sides block swept paths; entrances remain open. Tail colliders include den side walls. A deterministic binary heap replaces the navigation graph's quadratic minimum-node scan.

## Checks

- Frontend and worker TypeScript/builds passed.
- All new path waypoints and 18 resting destinations connect to the nest; swept paths cannot cross den side walls.
- Affinity preference, rival avoidance and full-den reservation checks passed.
- 1,200 movement updates each at 40, 90 and 110 residents: 23, 19 and 25 distinct den visitors, respectively; no duplicate reservations, invalid terrain positions or nonfinite coordinates.
- 15,000 random walkability comparisons against an independent area scan and 20,000 path equivalence comparisons passed.
- Navigation, encounters, ecology, and clustered departure regressions passed.
- Chromium local visual check loaded the Blender habitat and new courtyard without page errors.

The v5-to-v6 staging transition archives the previous world in the operator-only engine history table. World JSON, simulation tick and clock are unchanged across the transition; the existing run is preserved. This audit checkpoint does not replace a full database backup. Physical mobile hardware and long-duration rendering at 110 rats were not measured in these checks.

Deployment verified: public observer returned engine v6 with the same third run, 88 living rats, courtyard visitors and a den reservation. Payments remained disabled.
