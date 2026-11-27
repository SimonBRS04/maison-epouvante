-- Troc schema. Idempotent: executed by the service at every start-up.
CREATE SEQUENCE IF NOT EXISTS offer_number;

CREATE TABLE IF NOT EXISTS offers (
  id          TEXT        PRIMARY KEY,
  membre_id   TEXT        NOT NULL,
  titre       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  type        TEXT        NOT NULL CHECK (type IN ('echange', 'don')),
  categorie   TEXT        NOT NULL,
  cree_a      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offers_categorie_idx ON offers (categorie);
