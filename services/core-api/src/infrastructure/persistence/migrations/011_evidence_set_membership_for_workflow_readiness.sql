ALTER TABLE evidence_management_items
ADD COLUMN evidence_set_ids_json TEXT NOT NULL DEFAULT '[]';
