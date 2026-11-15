-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'credit_card';
-- O Postgres não permite usar um valor de enum na mesma transação em que ele foi criado;
-- commita a alteração do enum antes do CHECK abaixo, que referencia 'credit_card'.
COMMIT;

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "closing_day" INTEGER,
ADD COLUMN     "credit_limit" BIGINT,
ADD COLUMN     "due_day" INTEGER,
ADD COLUMN     "payment_account_id" UUID;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "installment_group_id" UUID,
ADD COLUMN     "installment_number" INTEGER,
ADD COLUMN     "installment_total" INTEGER,
ADD COLUMN     "invoice_month" DATE;

-- CreateIndex
CREATE INDEX "transactions_account_id_invoice_month_idx" ON "transactions"("account_id", "invoice_month");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Regra de negócio (spec C2, decisão R5): cartão de crédito exige limite e dias de
-- fechamento/vencimento válidos. "payment_account_id" fica fora do CHECK de propósito:
-- é validado na API (Tarefas 3/5) e a relação usa ON DELETE SET NULL, que um CHECK NOT NULL quebraria.
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_credit_card_fields_required" CHECK (
    "type" <> 'credit_card'
    OR (
        "credit_limit" IS NOT NULL
        AND "closing_day" IS NOT NULL
        AND "due_day" IS NOT NULL
        AND "closing_day" BETWEEN 1 AND 31
        AND "due_day" BETWEEN 1 AND 31
    )
);
