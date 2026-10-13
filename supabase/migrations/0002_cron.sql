-- Ikigai — расписание бота.
-- Раз в минуту база дёргает edge-функцию cron-tick; та сама решает, кому пора прислать напоминание
-- (в назначенную минуту) и кому уже наступило время утренней сводки в его часовом поясе, и не шлёт дважды.
--
-- Проще всего запускать через `bash scripts/update-bot.sh`: он сам придумывает пароль и подставляет оба значения.
-- Руками: заменить <PROJECT_REF> и <CRON_SECRET> на свои значения (см. docs/SETUP.md, раздел 6).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Повторный запуск не должен плодить дубли расписания.
select cron.unschedule(jobid) from cron.job where jobname = 'ikigai-tick';

select cron.schedule(
  'ikigai-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cron-tick',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
