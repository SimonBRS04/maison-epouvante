-- Catalogue schema. Idempotent: executed by the service at every start-up.
CREATE SEQUENCE IF NOT EXISTS product_number;

CREATE TABLE IF NOT EXISTS products (
  id                TEXT    PRIMARY KEY,
  nom               TEXT    NOT NULL,
  categorie         TEXT    NOT NULL,
  prix              INTEGER NOT NULL CHECK (prix >= 0),  -- cents, never floating point for money
  stock             INTEGER NOT NULL CHECK (stock >= 0),
  exclusif_en_ligne BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS products_categorie_idx ON products (categorie);
