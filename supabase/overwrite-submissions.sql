with ranked as (
  select
    id,
    row_number() over (
      partition by role, respondent_name
      order by created_at desc, id desc
    ) as row_number
  from public.september_survey_submissions
)
delete from public.september_survey_submissions as submission
using ranked
where submission.id = ranked.id
  and ranked.row_number > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'september_survey_submissions_role_respondent_name_key'
  ) then
    alter table public.september_survey_submissions
    add constraint september_survey_submissions_role_respondent_name_key
    unique (role, respondent_name);
  end if;
end $$;

drop policy if exists "allow survey update" on public.september_survey_submissions;

create policy "allow survey update"
on public.september_survey_submissions
for update
to anon
using (true)
with check (
  role in ('student', 'teacher')
  and respondent_name <> ''
);
