-- Expand gender column from VarChar(1) to VarChar(20) to support descriptive values
-- e.g. MULHER_CIS, MULHER_TRANS, HOMEM_CIS, HOMEM_TRANS, NAO_BINARIO, OUTRO, NAO_INFORMAR
ALTER TABLE survey.survey_responses
  ALTER COLUMN gender TYPE VARCHAR(20);
