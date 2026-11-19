ALTER TABLE "Ticket" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general', ADD COLUMN "orderId" TEXT;
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "OrderApprovalType" AS ENUM ('refund', 'cancellation');
CREATE TYPE "OrderApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "OrderApprovalRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "conversationId" TEXT,
    "type" "OrderApprovalType" NOT NULL,
    "status" "OrderApprovalStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "pendingKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderApprovalRequest_pendingKey_key" ON "OrderApprovalRequest"("pendingKey");
CREATE INDEX "OrderApprovalRequest_orderId_idx" ON "OrderApprovalRequest"("orderId");
CREATE INDEX "OrderApprovalRequest_conversationId_idx" ON "OrderApprovalRequest"("conversationId");
CREATE INDEX "OrderApprovalRequest_status_createdAt_idx" ON "OrderApprovalRequest"("status", "createdAt");

ALTER TABLE "OrderApprovalRequest" ADD CONSTRAINT "OrderApprovalRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderApprovalRequest" ADD CONSTRAINT "OrderApprovalRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
