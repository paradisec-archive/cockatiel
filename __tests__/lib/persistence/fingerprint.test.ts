import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@/lib/persistence/fingerprint';

describe('sha256Hex', () => {
  it('matches the known SHA-256 of an empty input', async () => {
    const hash = await sha256Hex(new ArrayBuffer(0));
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('matches the known SHA-256 of "abc"', async () => {
    const bytes = new TextEncoder().encode('abc');
    const hash = await sha256Hex(bytes.buffer as ArrayBuffer);
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('produces different hashes for different inputs', async () => {
    const a = await sha256Hex(new TextEncoder().encode('foo').buffer as ArrayBuffer);
    const b = await sha256Hex(new TextEncoder().encode('bar').buffer as ArrayBuffer);
    expect(a).not.toBe(b);
  });

  it('produces 64 lowercase hex characters', async () => {
    const hash = await sha256Hex(new TextEncoder().encode('anything').buffer as ArrayBuffer);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
