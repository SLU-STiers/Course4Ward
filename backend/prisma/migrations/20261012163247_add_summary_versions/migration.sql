-- CreateTable
CREATE TABLE "summary_versions" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" "SummaryStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "summary_versions_summaryId_createdAt_idx" ON "summary_versions"("summaryId", "createdAt");

-- AddForeignKey
ALTER TABLE "summary_versions" ADD CONSTRAINT "summary_versions_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "courses_in_ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
