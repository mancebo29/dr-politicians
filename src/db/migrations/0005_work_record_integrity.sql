-- Extends the claim_sources integrity from 0001 to work_record_items.
-- 0004 adds 'work_record_item' to claim_type in the same transaction as this
-- migration, and Postgres rejects that new value as a literal before commit
-- ("unsafe use of new enum value"). The trigger casts its argument at run time,
-- and the view spells the value as text::claim_type so the cast is resolved
-- when the view is queried, not when it is created.
CREATE TRIGGER work_record_items_delete_claim_sources AFTER DELETE ON work_record_items
  FOR EACH ROW EXECUTE FUNCTION delete_claim_sources('work_record_item');--> statement-breakpoint

CREATE OR REPLACE VIEW unsourced_claims AS
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
    WHERE NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'controversy' AND cs.claim_id = c.id)
  UNION ALL
  SELECT c.politician_id, 'work_record_item'::text::claim_type, c.id FROM work_record_items c
    WHERE NOT EXISTS (SELECT 1 FROM claim_sources cs WHERE cs.claim_type = 'work_record_item'::text::claim_type AND cs.claim_id = c.id);
