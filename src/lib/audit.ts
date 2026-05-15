import { prisma } from './prisma';
import { logger } from './logger';

export type AuditInput = {
  userId?: string | null;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

export async function audit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata: (input.metadata ?? {}) as object,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, input }, 'Failed to write audit log');
  }
}
