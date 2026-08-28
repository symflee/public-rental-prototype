export const MANUAL_RECRUITMENT_SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS public_rental_manual_recruitment_notices (
      notice_id text PRIMARY KEY CHECK (char_length(notice_id) BETWEEN 1 AND 64),
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
      url text NOT NULL CHECK (url ~ '^https://apply[.]lh[.]or[.]kr([/?#]|$)'),
      announced_at date NOT NULL,
      application_starts_at timestamptz NOT NULL,
      application_ends_at timestamptz NOT NULL,
      source_kind text NOT NULL CHECK (
        source_kind IN ('AUTOMATED_IMPORT', 'MANUAL_REVIEW')
      ),
      evidence_url text NOT NULL CHECK (
        evidence_url ~ '^https://apply[.]lh[.]or[.]kr([/?#]|$)'
      ),
      created_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz,
      CONSTRAINT public_rental_manual_recruitment_period_check CHECK (
        application_starts_at <= application_ends_at
      )
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS public_rental_manual_recruitment_locations (
      notice_id text NOT NULL REFERENCES public_rental_manual_recruitment_notices (notice_id),
      location_id text NOT NULL CHECK (char_length(location_id) BETWEEN 1 AND 200),
      PRIMARY KEY (notice_id, location_id)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS public_rental_manual_recruitment_active_index
    ON public_rental_manual_recruitment_notices (application_starts_at, application_ends_at)
    WHERE revoked_at IS NULL
  `,
  `
    CREATE INDEX IF NOT EXISTS public_rental_manual_recruitment_location_index
    ON public_rental_manual_recruitment_locations (location_id)
  `,
] as const;
