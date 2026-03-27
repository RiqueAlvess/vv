-- Anonymous feedback channel per company
CREATE TABLE IF NOT EXISTS core.company_feedback_channels (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL UNIQUE REFERENCES core.companies(id) ON DELETE CASCADE,
  public_token text        NOT NULL UNIQUE,
  active       boolean     DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.anonymous_feedbacks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid        NOT NULL REFERENCES core.company_feedback_channels(id) ON DELETE CASCADE,
  type       varchar(20) NOT NULL CHECK (type IN ('positivo','negativo','sugestao','outro')),
  category   varchar(30),
  message    text        NOT NULL,
  read       boolean     DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feedbacks_channel_id ON core.anonymous_feedbacks(channel_id);
CREATE INDEX idx_feedbacks_created_at ON core.anonymous_feedbacks(created_at DESC);
