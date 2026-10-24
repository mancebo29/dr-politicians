-- Accent-insensitive name search ("Jose" finds "José").
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- unaccent() is only STABLE because its dictionary could change; pinning the
-- dictionary makes it safe to declare IMMUTABLE so it can back an index.
-- Names are schema-qualified because index builds run with a restricted search_path.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION politician_search_text(full_name text, known_as text, aliases text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT lower(public.immutable_unaccent(concat_ws(' ', full_name, known_as, array_to_string(aliases, ' ')))) $$;--> statement-breakpoint

CREATE INDEX politicians_search_trgm ON politicians
  USING gin (public.politician_search_text(full_name, known_as, aliases) gin_trgm_ops);--> statement-breakpoint

-- claim_sources.claim_id is polymorphic (no FK), so remove its links when the
-- claim row goes away, including through ON DELETE CASCADE from politicians.
CREATE OR REPLACE FUNCTION delete_claim_sources() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  DELETE FROM claim_sources WHERE claim_type = TG_ARGV[0]::claim_type AND claim_id = OLD.id;
  RETURN OLD;
END
$$;--> statement-breakpoint

CREATE TRIGGER politicians_delete_claim_sources AFTER DELETE ON politicians
  FOR EACH ROW EXECUTE FUNCTION delete_claim_sources('politician_summary');--> statement-breakpoint
CREATE TRIGGER positions_delete_claim_sources AFTER DELETE ON positions
  FOR EACH ROW EXECUTE FUNCTION delete_claim_sources('position');--> statement-breakpoint
CREATE TRIGGER party_memberships_delete_claim_sources AFTER DELETE ON party_memberships
  FOR EACH ROW EXECUTE FUNCTION delete_claim_sources('party_membership');--> statement-breakpoint
CREATE TRIGGER alliances_delete_claim_sources AFTER DELETE ON alliances
  FOR EACH ROW EXECUTE FUNCTION delete_claim_sources('alliance');--> statement-breakpoint
CREATE TRIGGER politician_legislation_delete_claim_sources AFTER DELETE ON politician_legislation
  FOR EACH ROW EXECUTE FUNCTION delete_claim_sources('politician_legislation');--> statement-breakpoint
CREATE TRIGGER statements_delete_claim_sources AFTER DELETE ON statements
  FOR EACH ROW EXECUTE FUNCTION delete_claim_sources('statement');--> statement-breakpoint
CREATE TRIGGER controversies_delete_claim_sources AFTER DELETE ON controversies
  FOR EACH ROW EXECUTE FUNCTION delete_claim_sources('controversy');--> statement-breakpoint

-- Claims with no linked source. Publishing must refuse a profile that has any
-- rows here (PLAN §6.3: no source, no claim).
CREATE VIEW unsourced_claims AS
  SELECT p.id AS politician_id, 'politician_summary'::claim_type AS claim_type, p.id AS claim_id
    FROM politicians p
    WHERE p.summary IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'politician_summary' AND cs.claim_id = p.id)
  UNION ALL
  SELECT c.politician_id, 'position', c.id FROM positions c
    WHERE NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'position' AND cs.claim_id = c.id)
  UNION ALL
  SELECT c.politician_id, 'party_membership', c.id FROM party_memberships c
    WHERE NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'party_membership' AND cs.claim_id = c.id)
  UNION ALL
  SELECT c.politician_id, 'alliance', c.id FROM alliances c
    WHERE NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'alliance' AND cs.claim_id = c.id)
  UNION ALL
  SELECT c.politician_id, 'politician_legislation', c.id FROM politician_legislation c
    WHERE NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'politician_legislation' AND cs.claim_id = c.id)
  UNION ALL
  SELECT c.politician_id, 'statement', c.id FROM statements c
    WHERE NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'statement' AND cs.claim_id = c.id)
  UNION ALL
  SELECT c.politician_id, 'controversy', c.id FROM controversies c
    WHERE NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'controversy' AND cs.claim_id = c.id);
