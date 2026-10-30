-- Bonwa Phala database schema (Postgres / Neon).
-- Run once: paste into the Neon SQL editor, or run `npm run db:setup`.
-- Safe to run again; it only creates what's missing.

create table if not exists enquiries (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  lodge        text        not null check (lodge in ('main', 'bush')),
  stay         text        not null check (stay in ('rooms', 'whole')),
  arrival      date,                                  -- null = flexible dates
  nights       int         not null check (nights between 1 and 60),
  rooms        int         check (rooms between 1 and 40),  -- null for whole-lodge
  guests       int         not null check (guests between 1 and 200),
  occasion     text        not null,
  name         text        not null,
  email        text        not null,
  phone        text        not null default '',
  message      text        not null default '',
  est_total    int,                                   -- rand, null for whole-lodge quotes
  status       text        not null default 'new'
               check (status in ('new', 'contacted', 'confirmed', 'declined', 'cancelled')),
  admin_notes  text        not null default ''
);

create index if not exists enquiries_created_idx on enquiries (created_at desc);
create index if not exists enquiries_confirmed_idx on enquiries (lodge, arrival) where status = 'confirmed';

-- Dates the lodge has taken off sale: bookings made by phone, maintenance,
-- private use. start_date is the first night, end_date the check-out day.
create table if not exists blocks (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  lodge       text        not null check (lodge in ('main', 'bush')),
  start_date  date        not null,
  end_date    date        not null check (end_date > start_date),
  rooms       int         check (rooms between 1 and 40),  -- null = whole lodge
  note        text        not null default ''
);

create index if not exists blocks_range_idx on blocks (lodge, start_date, end_date);
