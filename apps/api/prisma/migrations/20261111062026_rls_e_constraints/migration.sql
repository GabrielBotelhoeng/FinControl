-- A API (dona das tabelas) ignora RLS. Os papéis anon/authenticated do Supabase
-- ficam sem nenhuma policy, ou seja, sem acesso pela API REST automática.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurrences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurrence_skips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_amount_positive" CHECK ("amount" > 0);
