-- Allow token_public to be null after use (Blind-Drop: token destroyed on submission)
ALTER TABLE survey.survey_invitations
  ALTER COLUMN token_public DROP NOT NULL;
