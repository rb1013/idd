-- Fix missing ON DELETE SET NULL on guardian FKs that were blocking guardian deletion

ALTER TABLE tutorials
  DROP CONSTRAINT tutorials_created_by_guardian_id_fkey,
  ADD CONSTRAINT tutorials_created_by_guardian_id_fkey
    FOREIGN KEY (created_by_guardian_id) REFERENCES guardians(id) ON DELETE SET NULL;

ALTER TABLE user_tutorials
  DROP CONSTRAINT user_tutorials_added_by_guardian_id_fkey,
  ADD CONSTRAINT user_tutorials_added_by_guardian_id_fkey
    FOREIGN KEY (added_by_guardian_id) REFERENCES guardians(id) ON DELETE SET NULL;
