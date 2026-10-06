-- A fresh world (Docs/plans/precious-deposits.md §1.5): the precious
-- materials now come from deposits dealt 3/2/1, so every board is replaced.
-- Deleting a board deletes its seats (on delete cascade); a player is then on
-- no board, and the client seats them again under the nickname they keep
-- (profiles are untouched, and so are friends, crests and the Inbox). Armies
-- out come home whole on the next join, and a world relic in a Chapel goes
-- back to the inventory as the client reads the new board.
--
-- RELEASE ORDER: deploy the `world` function FIRST, then push this — a join
-- between the two would otherwise make a board on the old rules.

delete from public.boards;
