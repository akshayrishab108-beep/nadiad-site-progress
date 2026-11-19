-- Site Progress Tracker: private per-user cloud state.
-- Run once in the Supabase SQL editor of the tracker's OWN project
-- (never in the CT Hub project). Then disable public sign-ups:
-- Authentication > Sign In / Providers > Email > "Allow new users to sign up" off,
-- after the owner's first magic-link sign-in has created their user.

create table if not exists public.tracker_kv (
    user_id uuid not null references auth.users (id) on delete cascade,
    key text not null,
    value jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, key)
);

alter table public.tracker_kv enable row level security;

-- Each signed-in user can read and write only their own rows. The anon key
-- alone (what the public site ships) returns zero rows without a session.
create policy "own rows only" on public.tracker_kv
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Signed-in users need table privileges; RLS above still confines each
-- session to its own rows. The unauthenticated anon role gets nothing.
grant select, insert, update, delete on public.tracker_kv to authenticated;
