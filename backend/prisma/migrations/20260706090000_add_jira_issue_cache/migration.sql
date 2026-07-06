-- CreateTable
CREATE TABLE "JiraIssueCache" (
    "issueId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "summary" TEXT,
    "projectName" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "JiraIssueCache_pkey" PRIMARY KEY ("issueId")
);
