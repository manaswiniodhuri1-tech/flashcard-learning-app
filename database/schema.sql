-- Flashcard Learning App schema
-- This starter MVP is a single shared study space with no user accounts.
-- Do not use this shared-data design for private or multi-user deployments.

create extension if not exists pgcrypto;

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(btrim(question)) between 1 and 500),
  answer text not null check (char_length(btrim(answer)) between 1 and 1000),
  category varchar(60) not null default 'General' check (char_length(btrim(category)) between 1 and 60),
  difficulty varchar(10) not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  known boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flashcards_created_at_idx on public.flashcards (created_at desc);
create index if not exists flashcards_category_idx on public.flashcards (category);
create index if not exists flashcards_known_idx on public.flashcards (known);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_flashcards_updated_at on public.flashcards;
create trigger set_flashcards_updated_at
before update on public.flashcards
for each row execute function public.set_updated_at();

-- The Express backend uses a server-side Supabase secret key and performs
-- validation before each operation. Browser clients do not connect directly.
-- RLS is enabled to block direct access using an ordinary public/anon key.
alter table public.flashcards enable row level security;

-- No anon/authenticated policies are created intentionally. Direct browser
-- access is denied; the trusted server-side key bypasses RLS. Protect that
-- key and keep backend authorization checks in place if roles are added later.
