-- CreateEnum
CREATE TYPE "LoanKind" AS ENUM ('personal', 'payroll_inss', 'payroll_public', 'payroll_private', 'vehicle', 'mortgage', 'other');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "loan_id" UUID;

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LoanKind" NOT NULL,
    "bank_name" TEXT NOT NULL,
    "bank_cnpj8" CHAR(8),
    "principal" BIGINT NOT NULL,
    "installment_amount" BIGINT NOT NULL,
    "installments_total" INTEGER NOT NULL,
    "installments_paid_before" INTEGER NOT NULL DEFAULT 0,
    "first_due_date" DATE NOT NULL,
    "account_id" UUID NOT NULL,
    "informed_monthly_rate" DECIMAL(9,6),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_rates" (
    "id" UUID NOT NULL,
    "modality" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "institution" TEXT NOT NULL,
    "cnpj8" CHAR(8) NOT NULL,
    "monthly_rate" DECIMAL(9,4) NOT NULL,
    "annual_rate" DECIMAL(9,4) NOT NULL,
    "position" INTEGER NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loans_user_id_idx" ON "loans"("user_id");

-- CreateIndex
CREATE INDEX "bank_rates_cnpj8_idx" ON "bank_rates"("cnpj8");

-- CreateIndex
CREATE UNIQUE INDEX "bank_rates_modality_cnpj8_key" ON "bank_rates"("modality", "cnpj8");

-- CreateIndex
CREATE INDEX "transactions_loan_id_idx" ON "transactions"("loan_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- A API (dona das tabelas) ignora RLS; anon/authenticated ficam sem policy (padrão de 20261111062026_rls_e_constraints).
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_rates" ENABLE ROW LEVEL SECURITY;

-- Regras do cadastro (spec seção 8): valores positivos, prazo finito e "já pagas" menor que o total.
ALTER TABLE "loans" ADD CONSTRAINT "loans_values_valid" CHECK (
    "principal" > 0
    AND "installment_amount" > 0
    AND "installments_total" BETWEEN 1 AND 480
    AND "installments_paid_before" >= 0
    AND "installments_paid_before" < "installments_total"
);

-- Categoria padrão nova (spec seção 3) para os perfis que já existem.
INSERT INTO "categories" ("id", "user_id", "name", "type", "icon", "color", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'Empréstimos e financiamentos', 'expense', 'landmark', '#0f766e', now(), now()
FROM "profiles"
ON CONFLICT ("user_id", "type", "name") DO NOTHING;
