-- Run only after create-token-access.sql. The raw token is returned once and is
-- never stored in the database. Handle the result as confidential information.
with generated as materialized (
  select
    person.id as person_id,
    person.role,
    person.name,
    person.grade,
    encode(gen_random_bytes(32), 'hex') as raw_token
  from public.september_survey_people person
  where person.active = true
), saved as (
  insert into public.september_survey_access_tokens (
    person_id,
    token_hash,
    active,
    expires_at
  )
  select
    generated.person_id,
    encode(digest(generated.raw_token, 'sha256'), 'hex'),
    true,
    now() + interval '45 days'
  from generated
  on conflict (person_id)
  do update set
    token_hash = excluded.token_hash,
    active = true,
    expires_at = excluded.expires_at,
    created_at = now()
  returning person_id
)
select
  generated.role,
  generated.name,
  generated.grade,
  'https://september-survey.vercel.app/?token=' || generated.raw_token as response_url
from generated
join saved using (person_id)
order by generated.role, generated.grade nulls last, generated.name;
