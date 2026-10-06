-- A world of seven boards (Docs/plans/precious-deposits.md §3): the board
-- document is now a whole world — 42 seats, 889 hexes — so every board is
-- replaced, as in 20261011000000_fresh_world.sql: a player is seated again
-- under the nickname they keep; armies come home and Chapels empty.
--
-- RELEASE ORDER: deploy the `world` function FIRST, then push this.

delete from public.boards;
