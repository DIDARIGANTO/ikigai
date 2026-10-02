-- Ikigai — расписание утренней сводки.
-- Раз в 5 минут база дёргает edge-функцию cron-tick; та сама решает, кому
-- уже наступило время сводки в его часовом поясе, и не шлёт дважды.
--
-- ПЕРЕД ЗАПУСКОМ заменить <PROJECT_REF> и <CRON_SECRET> на свои значения
-- (см. docs/SETUP.md, раздел 6).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Повторный запуск не должен плодить дубли расписания.
select cron.unschedule(jobid) from cron.job where jobname = 'ikigai-tick';

select cron.schedule(
  'ikigai-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cron-tick',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
