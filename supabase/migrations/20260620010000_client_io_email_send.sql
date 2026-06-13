-- Client IO email recipients + send history tracking

ALTER TABLE public.client_ios
  ADD COLUMN IF NOT EXISTS send_recipients jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.client_ios.send_recipients IS
  'JSON array [{name, email}, ...] — recipients configured before sending the Client IO';

ALTER TABLE public.io_notifications
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS gmail_message_id text,
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS send_batch_id uuid;

CREATE INDEX IF NOT EXISTS io_notifications_io_id_created_idx
  ON public.io_notifications (io_id, created_at DESC)
  WHERE io_type = 'client' AND event_type = 'client_io_sent';
