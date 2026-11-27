-- One database per service (each service owns its data), plus one for Keycloak (Lot 3).
-- Tables are created by each service on start-up (services/<name>/db/schema.sql).
CREATE DATABASE catalogue;
CREATE DATABASE troc;
CREATE DATABASE notifications;
CREATE DATABASE keycloak;
