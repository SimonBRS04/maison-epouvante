-- Notifications schema. Idempotent: executed by the service at every start-up.
CREATE SEQUENCE IF NOT EXISTS notification_number;

CREATE TABLE IF NOT EXISTS notifications (
  id        TEXT        PRIMARY KEY,
  membre_id TEXT        NOT NULL,
  offer_id  TEXT        NOT NULL,
  titre     TEXT        NOT NULL,
  categorie TEXT        NOT NULL,
  cree_a    TIMESTAMPTZ NOT NULL DEFAULT now(),
  lue       BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS notifications_membre_idx ON notifications (membre_id);

-- Events already handled, so that a redelivered event creates no duplicate.
CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT        PRIMARY KEY,
  traite_a TIMESTAMPTZ NOT NULL DEFAULT now()
);
