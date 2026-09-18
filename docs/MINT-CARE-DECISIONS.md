# Mint and care — approved scope, 2026-09-18

These are product decisions, not evidence that public payments are operational.

- Mint burns 500,000 RATTERY through native burn(uint256). Ownership is recorded by the authoritative service, not an NFT.
- Ownership cannot be transferred at launch. Before mint, any authenticated wallet may care for an unminted rat; after mint, only its owner. Observation remains free.
- Names: 1–24 Unicode characters after trimming; duplicate names allowed. Owner may rename without payment once every 24 real hours, including the initial mint cooldown.
- Death ends paid interactions. Name, caregiver and history remain in the memorial. Confirmed burns cannot be reversed; failed finalization requires reconciliation, never an automatic second charge.
- Existing care prices and cooldowns in CARE_RULES remain approved.

## Fictional behavioural boosters (included at launch)

Both cost 100,000 RATTERY per use. Adult rats only, subject to eligibility before reservation. A 2-real-hour cooldown is shared across both actions per rat. One active stimulus, with no stacked doses; stimulus lasts 2 real hours. Sociability uses the prosocial action, irritability uses aggression. The simulation biases nearby social affinity; outcomes are not guaranteed, and ordinary social history can outlast the stimulus. These do not model real anabolic drugs or directly command mating/fighting. Public paid activation still requires the complete authenticated, persistent financial integration.

## Remaining implementation

Mainnet/domain authentication; public reservation and receipt reconciliation; wallet transaction UI; authoritative ownership and free renaming; preservation under death/concurrent state changes; hosted end-to-end tests. Do not enable paid actions solely because the scope is approved.
