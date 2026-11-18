-- Assistente com IA (spec 2026-11-18, A5): consentimento para enviar dados à Anthropic.
ALTER TABLE "profiles" ADD COLUMN "ai_consent_at" TIMESTAMPTZ;

-- A9: uso por pessoa e dia (limite entre instâncias e registro do gasto de tokens).
CREATE TABLE "ai_usage" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("user_id","day")
);

CREATE INDEX "ai_usage_day_idx" ON "ai_usage"("day");

ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A API (dona das tabelas) ignora RLS; anon/authenticated ficam sem policy (padrão de 20261111062026_rls_e_constraints).
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
