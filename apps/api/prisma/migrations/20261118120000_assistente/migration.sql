-- Assistente com IA (spec 2026-11-18, A5): consentimento para enviar dados à Anthropic.
ALTER TABLE "profiles" ADD COLUMN "ai_consent_at" TIMESTAMPTZ;
