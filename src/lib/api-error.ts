import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: Record<string, string>,
) {
  const body: ApiErrorBody = { error: { code, message, details } };
  return NextResponse.json(body, { status, headers });
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    return jsonError(400, 'validation_error', 'Invalid request', err.flatten());
  }
  logger.error({ err }, 'Unhandled API error');
  return jsonError(500, 'internal_error', 'Internal server error');
}
