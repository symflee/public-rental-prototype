CREATE TABLE IF NOT EXISTS public_rental_notice_email_subscriptions (
  subscription_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location_id text NOT NULL CHECK (
    char_length(location_id) BETWEEN 1 AND 200
  ),
  location_name_snapshot text NOT NULL CHECK (
    char_length(location_name_snapshot) BETWEEN 1 AND 300
  ),
  email text NOT NULL CHECK (
    char_length(email) BETWEEN 3 AND 254
  ),
  email_normalized text NOT NULL CHECK (
    char_length(email_normalized) BETWEEN 3 AND 254
  ),
  consent_version text NOT NULL CHECK (
    char_length(consent_version) BETWEEN 1 AND 50
  ),
  consented_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  notified_at timestamptz,
  notified_notice_id text CHECK (
    notified_notice_id IS NULL OR char_length(notified_notice_id) BETWEEN 1 AND 200
  ),
  CONSTRAINT public_rental_notice_email_subscription_expiry_check CHECK (
    expires_at > consented_at
  ),
  CONSTRAINT public_rental_notice_email_subscription_notification_check CHECK (
    (notified_at IS NULL) = (notified_notice_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS public_rental_notice_email_subscription_active_unique
ON public_rental_notice_email_subscriptions (location_id, email_normalized)
WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS public_rental_notice_email_subscription_pending_index
ON public_rental_notice_email_subscriptions (created_at)
WHERE notified_at IS NULL;
