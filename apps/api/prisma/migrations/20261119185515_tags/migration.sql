-- AlterTable
ALTER TABLE "recurrences" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Sub-projeto 13 (T1): no máximo 10 tags, e a lista nunca é nula (a API sempre grava a lista, mesmo vazia).
ALTER TABLE "transactions" ALTER COLUMN "tags" SET NOT NULL;
ALTER TABLE "recurrences" ALTER COLUMN "tags" SET NOT NULL;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tags_max" CHECK (cardinality("tags") <= 10);
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_tags_max" CHECK (cardinality("tags") <= 10);
