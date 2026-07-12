-- CreateTable
CREATE TABLE "QuoteMaterial" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteMaterial_quoteId_idx" ON "QuoteMaterial"("quoteId");

-- AddForeignKey
ALTER TABLE "QuoteMaterial" ADD CONSTRAINT "QuoteMaterial_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
