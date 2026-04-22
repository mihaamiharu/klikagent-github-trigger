import * as crypto from 'crypto';
import { validateSignature } from './validator';
import { Request } from 'express';

const SECRET = 'test-secret';
const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV, GITHUB_WEBHOOK_SECRET: SECRET };
});

afterEach(() => {
  process.env = OLD_ENV;
});

function makeRequest(body: string, signature?: string): Request {
  const buf = Buffer.from(body);
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(buf);
  const validSig = `sha256=${hmac.digest('hex')}`;

  return {
    headers: { 'x-hub-signature-256': signature ?? validSig },
    body: buf,
  } as unknown as Request;
}

describe('validateSignature', () => {
  it('returns true for a valid signature', () => {
    expect(validateSignature(makeRequest('{"action":"labeled"}'))).toBe(true);
  });

  it('returns false for a tampered body', () => {
    const req = makeRequest('{"action":"labeled"}');
    (req as unknown as Record<string, unknown>).body = Buffer.from('{"action":"unlabeled"}');
    expect(validateSignature(req)).toBe(false);
  });

  it('returns false for a wrong secret', () => {
    const buf = Buffer.from('{"action":"labeled"}');
    const hmac = crypto.createHmac('sha256', 'wrong-secret');
    hmac.update(buf);
    const badSig = `sha256=${hmac.digest('hex')}`;
    const req = { headers: { 'x-hub-signature-256': badSig }, body: buf } as unknown as Request;
    expect(validateSignature(req)).toBe(false);
  });

  it('returns false when signature header is missing', () => {
    const req = { headers: {}, body: Buffer.from('{}') } as unknown as Request;
    expect(validateSignature(req)).toBe(false);
  });

  it('throws when GITHUB_WEBHOOK_SECRET is not set', () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    expect(() => validateSignature(makeRequest('{}'))).toThrow('GITHUB_WEBHOOK_SECRET');
  });
});
