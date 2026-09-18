-- Operator-run migration: allow explicit mainnet intents, without enabling any endpoint.
ALTER TABLE care_intents DROP CONSTRAINT care_intents_chain_id_check;
ALTER TABLE care_intents ADD CONSTRAINT care_intents_chain_id_check CHECK(chain_id IN (4663,46630));
