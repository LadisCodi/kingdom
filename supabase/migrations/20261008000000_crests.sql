-- A kingdom's crest (Docs/features/15-social.md §2.2): `<tincture>.<charge>`,
-- reported by its own client with every hello; null while it wears the one
-- its nickname picks. The world board keeps its own copy on the seat.

alter table public.profiles
  add column crest text check (crest is null or crest ~ '^[a-z]+\.[a-z]+$');
