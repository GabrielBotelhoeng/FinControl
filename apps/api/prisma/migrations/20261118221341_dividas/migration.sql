-- CreateEnum
CREATE TYPE "DebtKind" AS ENUM ('bank', 'store', 'utility', 'tax', 'person', 'other');

-- CreateEnum
CREATE TYPE "DebtEventKind" AS ENUM ('valuation', 'agreement', 'note');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "debt_id" UUID;

-- CreateTable
CREATE TABLE "debts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "creditor" TEXT NOT NULL,
    "kind" "DebtKind" NOT NULL,
    "original_amount" BIGINT NOT NULL,
    "since" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_events" (
    "id" UUID NOT NULL,
    "debt_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "DebtEventKind" NOT NULL,
    "date" DATE NOT NULL,
    "amount" BIGINT,
    "note" TEXT,
    "down_payment" BIGINT,
    "installments" INTEGER,
    "installment_amount" BIGINT,
    "cancelled_at" TIMESTAMPTZ,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debts_user_id_idx" ON "debts"("user_id");

-- CreateIndex
CREATE INDEX "debt_events_debt_id_idx" ON "debt_events"("debt_id");

-- CreateIndex
CREATE INDEX "transactions_debt_id_idx" ON "transactions"("debt_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_events" ADD CONSTRAINT "debt_events_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A API (dona das tabelas) ignora RLS; anon/authenticated ficam sem policy (padrão de 20261111062026_rls_e_constraints).
ALTER TABLE "debts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "debt_events" ENABLE ROW LEVEL SECURITY;

-- Valores (spec do sub-projeto 6): original positivo; âncoras com valor não negativo; acordo completo e coerente.
ALTER TABLE "debts" ADD CONSTRAINT "debts_original_positive" CHECK ("original_amount" > 0);
ALTER TABLE "debt_events" ADD CONSTRAINT "debt_events_valid" CHECK (
    ("kind" = 'valuation' AND "amount" IS NOT NULL AND "amount" >= 0 AND "installments" IS NULL)
    OR ("kind" = 'note' AND "note" IS NOT NULL AND ("amount" IS NULL OR "amount" > 0) AND "installments" IS NULL)
    OR ("kind" = 'agreement' AND "down_payment" >= 0 AND "installments" BETWEEN 1 AND 120 AND "installment_amount" > 0
        AND "amount" = "down_payment" + "installments" * "installment_amount")
);
