-- Apply only after the Edge Function and token-based Vercel form are verified.
begin;

revoke select, maintain
on table public.september_survey_people
from anon;

drop policy if exists "allow people select"
on public.september_survey_people;

revoke insert, maintain
on table public.september_survey_submissions
from anon;

drop policy if exists "allow survey insert"
on public.september_survey_submissions;

revoke all
on table public.september_survey_access_tokens
from anon, authenticated;

commit;
