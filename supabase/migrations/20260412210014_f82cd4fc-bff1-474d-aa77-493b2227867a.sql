
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'scan-all-emails-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--e35fe031-9c7f-4f24-ac03-1474b0aafb32.lovable-project.com/hooks/scan-all-emails',
    headers := '{"Content-Type": "application/json", "Lovable-Context": "cron", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvenBzaXJ1aWFjZ3F2ZHplY2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDM4NzYsImV4cCI6MjA5MTU3OTg3Nn0.Bm4cEKLRSucK7fMeWovjSjXf6rA5YXhslh7P20KbS5w"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
