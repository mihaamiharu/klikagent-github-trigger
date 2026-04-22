import * as crypto from 'crypto';
import { Request } from 'express';

/**
 * Validates the GitHub HMAC-SHA256 webhook signature.
 * GitHub sends the signature in the x-hub-signature-256 header.
 * Requires the raw request body (express.raw middleware).
 */
export function validateSignature(req: Request): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('GITHUB_WEBHOOK_SECRET env var is not set');
  }

  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature) return false;

  const body = req.body as Buffer;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const expected = `sha256=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}
