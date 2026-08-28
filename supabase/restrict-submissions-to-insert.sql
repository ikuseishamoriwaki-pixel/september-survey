revoke select, update, delete, truncate, references, trigger, maintain
on table public.september_survey_submissions
from anon;

grant insert
on table public.september_survey_submissions
to anon;

drop policy if exists "allow survey select"
on public.september_survey_submissions;

drop policy if exists "allow survey update"
on public.september_survey_submissions;

drop policy if exists "allow survey delete"
on public.september_survey_submissions;
