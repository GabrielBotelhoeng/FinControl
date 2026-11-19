-- Revisão final do sub-projeto 6: o acordo não pode ter campo nulo (no CHECK anterior, NULL passava).
ALTER TABLE "debt_events" ADD CONSTRAINT "debt_events_agreement_complete" CHECK (
    "kind" <> 'agreement'
    OR ("amount" IS NOT NULL AND "down_payment" IS NOT NULL AND "installments" IS NOT NULL AND "installment_amount" IS NOT NULL)
);

-- Um lançamento é parcela de empréstimo ou pagamento de dívida, nunca os dois.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loan_or_debt" CHECK ("loan_id" IS NULL OR "debt_id" IS NULL);
