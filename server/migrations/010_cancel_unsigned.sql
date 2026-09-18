ALTER TABLE care_intents DROP CONSTRAINT care_intents_status_check;
ALTER TABLE care_intents ADD CONSTRAINT care_intents_status_check CHECK(status IN ('reserved','applied','review','cancelled'));
