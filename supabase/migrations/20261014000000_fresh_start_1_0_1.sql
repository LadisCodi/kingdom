-- The 1.0.1 fresh start: every tester begins a new kingdom (the client's
-- PROTOTYPE_FRESH_START, raised to 107), so the world begins again too — a
-- new kingdom must not find the old one's districts, armies and Chapels on
-- the board. Deleting a board deletes its seats (on delete cascade); the
-- client seats the player again under the nickname they keep. Profiles,
-- friends, crests and the Inbox are untouched.
--
-- No change to the `world` function: this is pushed on its own.

delete from public.boards;
