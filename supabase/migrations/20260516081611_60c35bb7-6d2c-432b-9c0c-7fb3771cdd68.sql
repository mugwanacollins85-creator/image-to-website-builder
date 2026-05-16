ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS mpesa_checkout_id text,
  ADD COLUMN IF NOT EXISTS mpesa_receipt text,
  ADD COLUMN IF NOT EXISTS last_payment_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS bookings_mpesa_checkout_id_idx
  ON public.bookings (mpesa_checkout_id);

ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.booking_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'booking_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_events;
  END IF;
END $$;