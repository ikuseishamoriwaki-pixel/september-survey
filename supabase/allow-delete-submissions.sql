drop policy if exists "allow survey delete" on public.september_survey_submissions;

create policy "allow survey delete"
on public.september_survey_submissions
for delete
to anon
using (true);
