-- Auditoria final (2026-11-20).

-- LGPD: ids de contas excluídas, para um token antigo não recriar o perfil.
CREATE TABLE "deleted_users" (
    "id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_users_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "deleted_users" ENABLE ROW LEVEL SECURITY;

-- A tabela do Prisma era a única sem RLS e podia ser lida pela API REST do Supabase com a chave pública.
-- O dono (quem roda as migrations) continua com acesso; os papéis da API REST perdem.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "_prisma_migrations" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "_prisma_migrations" FROM authenticated;
  END IF;
END $$;

-- Índices das chaves estrangeiras que faltavam: excluir uma categoria ou conta não varre a tabela inteira.
CREATE INDEX "accounts_payment_account_id_idx" ON "accounts"("payment_account_id");
CREATE INDEX "recurrences_account_id_idx" ON "recurrences"("account_id");
CREATE INDEX "recurrences_category_id_idx" ON "recurrences"("category_id");
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");
CREATE INDEX "transactions_destination_account_id_idx" ON "transactions"("destination_account_id");
CREATE INDEX "loans_account_id_idx" ON "loans"("account_id");
CREATE INDEX "budgets_category_id_idx" ON "budgets"("category_id");
