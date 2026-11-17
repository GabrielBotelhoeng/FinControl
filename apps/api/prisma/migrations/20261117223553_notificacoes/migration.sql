-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "notification_prefs" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_last_active_at_idx" ON "notifications"("last_active_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_key_key" ON "notifications"("user_id", "key");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A API (dona das tabelas) ignora RLS; anon/authenticated ficam sem policy (padrão de 20261111062026_rls_e_constraints).
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
