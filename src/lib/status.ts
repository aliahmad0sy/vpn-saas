import type { InvoiceStatus, ServerStatus, SubscriptionStatus, PeerSyncStatus } from '@prisma/client';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'default';

export const subscriptionStatusTone: Record<SubscriptionStatus, BadgeTone> = {
  ACTIVE: 'success',
  TRIALING: 'info',
  PAST_DUE: 'warning',
  CANCELED: 'danger',
  INCOMPLETE: 'warning',
  INCOMPLETE_EXPIRED: 'danger',
  UNPAID: 'danger',
};

export const invoiceStatusTone: Record<InvoiceStatus, BadgeTone> = {
  PAID: 'success',
  OPEN: 'info',
  DRAFT: 'default',
  UNCOLLECTIBLE: 'danger',
  VOID: 'default',
};

export const serverStatusTone: Record<ServerStatus, BadgeTone> = {
  ONLINE: 'success',
  MAINTENANCE: 'warning',
  OFFLINE: 'danger',
};

export const syncJobStatusTone: Record<PeerSyncStatus, BadgeTone> = {
  PENDING: 'default',
  RUNNING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'danger',
};
