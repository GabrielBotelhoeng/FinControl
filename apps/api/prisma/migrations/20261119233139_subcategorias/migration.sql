-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "parent_id" UUID;

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Sub-projeto 15 (U1): uma categoria nunca é a própria categoria principal. O nível único e o mesmo dono e tipo da
-- categoria ficam na API, que cria a subcategoria a partir da principal.
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_not_self" CHECK ("parent_id" <> "id");
