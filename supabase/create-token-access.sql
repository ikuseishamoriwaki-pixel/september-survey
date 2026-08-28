create extension if not exists pgcrypto;

create table if not exists public.september_survey_access_tokens (
  id uuid primary key default gen_random_uuid(),
  person_id bigint not null unique references public.september_survey_people(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.september_survey_access_tokens enable row level security;

revoke all
on table public.september_survey_access_tokens
from anon, authenticated;

grant select, insert, update, delete
on table public.september_survey_access_tokens
to service_role;

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.september_survey_rate_limits (
  request_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (request_key, window_started_at)
);

revoke all
on table private.september_survey_rate_limits
from public, anon, authenticated;

create or replace function public.check_september_survey_rate_limit(
  p_request_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if p_request_key is null
    or length(p_request_key) < 8
    or length(p_request_key) > 128
    or p_max_requests < 1
    or p_max_requests > 100
    or p_window_seconds < 60
    or p_window_seconds > 3600 then
    return false;
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into private.september_survey_rate_limits (
    request_key,
    window_started_at,
    request_count
  ) values (
    p_request_key,
    v_window_started_at,
    1
  )
  on conflict (request_key, window_started_at)
  do update set request_count = private.september_survey_rate_limits.request_count + 1
  returning request_count into v_request_count;

  delete from private.september_survey_rate_limits
  where window_started_at < clock_timestamp() - interval '1 day';

  return v_request_count <= p_max_requests;
end;
$$;

revoke all
on function public.check_september_survey_rate_limit(text, integer, integer)
from public, anon, authenticated;

grant execute
on function public.check_september_survey_rate_limit(text, integer, integer)
to service_role;
