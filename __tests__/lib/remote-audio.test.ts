import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deriveFilename,
  fetchRemoteAudio,
  filenameFromPath,
  inspectRemoteAudio,
  parseContentDispositionFilename,
  RemoteAudioError,
  validateUrl,
} from '@/lib/remote-audio';

describe('validateUrl', () => {
  it('accepts an https URL', () => {
    const url = validateUrl('https://example.com/audio.wav');
    expect(url.host).toBe('example.com');
  });

  it('rejects http URLs', () => {
    expect(() => validateUrl('http://example.com/audio.wav')).toThrow(RemoteAudioError);
  });

  it('rejects unsupported schemes', () => {
    for (const raw of ['ftp://x/y', 'file:///etc/hosts', 'data:audio/wav;base64,AAAA']) {
      expect(() => validateUrl(raw)).toThrow(/https/i);
    }
  });

  it('rejects garbage input', () => {
    expect(() => validateUrl('not a url')).toThrow(/valid URL/i);
  });
});

describe('parseContentDispositionFilename', () => {
  it('returns undefined for null', () => {
    expect(parseContentDispositionFilename(null)).toBeUndefined();
  });

  it('parses a plain filename', () => {
    expect(parseContentDispositionFilename('attachment; filename=foo.wav')).toBe('foo.wav');
  });

  it('parses a quoted filename and unescapes', () => {
    expect(parseContentDispositionFilename('attachment; filename="my \\"audio\\".wav"')).toBe('my "audio".wav');
  });

  it('prefers RFC 5987 filename* and decodes percent-encoding', () => {
    expect(parseContentDispositionFilename("attachment; filename=fallback.wav; filename*=UTF-8''my%20audio.wav")).toBe('my audio.wav');
  });
});

describe('filenameFromPath', () => {
  it('returns the last path segment', () => {
    expect(filenameFromPath(new URL('https://example.com/a/b/foo.wav'))).toBe('foo.wav');
  });

  it('decodes percent-encoding', () => {
    expect(filenameFromPath(new URL('https://example.com/my%20audio.wav'))).toBe('my audio.wav');
  });

  it('returns undefined for empty paths', () => {
    expect(filenameFromPath(new URL('https://example.com'))).toBeUndefined();
  });
});

describe('deriveFilename', () => {
  it('prefers Content-Disposition over the URL path', () => {
    const url = new URL('https://example.com/raw/123');
    expect(deriveFilename(url, 'attachment; filename=server.wav')).toBe('server.wav');
  });

  it('falls back to the URL path segment', () => {
    expect(deriveFilename(new URL('https://example.com/foo.wav'), null)).toBe('foo.wav');
  });

  it('uses remote-audio.wav as a last resort', () => {
    expect(deriveFilename(new URL('https://example.com'), null)).toBe('remote-audio.wav');
  });
});

const mockResponse = (init: { ok?: boolean; status?: number; headers?: Record<string, string>; body?: Uint8Array | null }): Response => {
  const { ok = true, status = 200, headers = {}, body = null } = init;
  return {
    ok,
    status,
    headers: new Headers(headers),
    body: body
      ? new ReadableStream({
          start(controller) {
            const chunkSize = Math.max(1, Math.floor(body.byteLength / 3));
            for (let i = 0; i < body.byteLength; i += chunkSize) {
              controller.enqueue(body.slice(i, Math.min(i + chunkSize, body.byteLength)));
            }
            controller.close();
          },
        })
      : null,
    arrayBuffer: async () => (body ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new ArrayBuffer(0)),
  } as unknown as Response;
};

describe('inspectRemoteAudio', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('issues a range-GET (Range: bytes=0-0) rather than a HEAD', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(mockResponse({ status: 206, headers: { 'Content-Range': 'bytes 0-0/12345' } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await inspectRemoteAudio(new URL('https://example.com/x'), new AbortController().signal);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ Range: 'bytes=0-0' });
    expect(init?.method).toBeUndefined(); // defaults to GET
  });

  it('parses size from Content-Range on a 206 response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse({ status: 206, headers: { 'Content-Range': 'bytes 0-0/12345', 'Content-Disposition': 'attachment; filename=foo.wav' } }),
    );
    const meta = await inspectRemoteAudio(new URL('https://example.com/x'), new AbortController().signal);
    expect(meta).toEqual({ filename: 'foo.wav', size: 12345 });
  });

  it('omits size when Content-Range total is unknown (bytes 0-0/*)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ status: 206, headers: { 'Content-Range': 'bytes 0-0/*' } }));
    const meta = await inspectRemoteAudio(new URL('https://example.com/foo.wav'), new AbortController().signal);
    expect(meta.size).toBeUndefined();
  });

  it('falls back to Content-Length when the server ignores Range (200 response)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ status: 200, headers: { 'Content-Length': '98765' } }));
    const meta = await inspectRemoteAudio(new URL('https://example.com/foo.wav'), new AbortController().signal);
    expect(meta.size).toBe(98765);
  });

  it('omits size when neither Content-Range nor Content-Length is usable', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ status: 200 }));
    const meta = await inspectRemoteAudio(new URL('https://example.com/foo.wav'), new AbortController().signal);
    expect(meta.size).toBeUndefined();
    expect(meta.filename).toBe('foo.wav');
  });

  it('throws not-found for 404', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ ok: false, status: 404 }));
    await expect(inspectRemoteAudio(new URL('https://example.com/x'), new AbortController().signal)).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('throws server-error for 5xx', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ ok: false, status: 503 }));
    await expect(inspectRemoteAudio(new URL('https://example.com/x'), new AbortController().signal)).rejects.toMatchObject({ kind: 'server-error' });
  });

  it('maps TypeError to a CORS-style error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(inspectRemoteAudio(new URL('https://example.com/x'), new AbortController().signal)).rejects.toMatchObject({ kind: 'cors' });
  });
});

describe('fetchRemoteAudio', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('streams bytes and reports progress fractions that monotonically reach 1', async () => {
    const payload = new Uint8Array(300).map((_, i) => i % 256);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ body: payload, headers: { 'Content-Length': '300' } }));
    const progress: number[] = [];
    const file = await fetchRemoteAudio(new URL('https://example.com/foo.wav'), {
      filename: 'foo.wav',
      signal: new AbortController().signal,
      onProgress: (p) => {
        if (typeof p.fraction === 'number') {
          progress.push(p.fraction);
        }
      },
    });
    expect(file.name).toBe('foo.wav');
    expect(file.size).toBe(300);
    expect(file.type).toBe('audio/wav');
    expect(progress.at(-1)).toBe(1);
    // monotonic
    for (let i = 1; i < progress.length; i += 1) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    }
    // never >1 until the final tick
    for (let i = 0; i < progress.length - 1; i += 1) {
      expect(progress[i]).toBeLessThan(1);
    }
  });

  it('omits fraction when Content-Length is absent', async () => {
    const payload = new Uint8Array(64);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse({ body: payload }));
    const fractions: (number | undefined)[] = [];
    await fetchRemoteAudio(new URL('https://example.com/foo.wav'), {
      filename: 'foo.wav',
      signal: new AbortController().signal,
      onProgress: (p) => fractions.push(p.fraction),
    });
    // intermediate ticks have no fraction; only the final completion tick is 1.
    const intermediate = fractions.slice(0, -1);
    expect(intermediate.every((f) => f === undefined)).toBe(true);
    expect(fractions.at(-1)).toBe(1);
  });

  it('overrides filename from Content-Disposition when present', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse({ body: new Uint8Array(4), headers: { 'Content-Disposition': 'attachment; filename=server.mp3' } }),
    );
    const file = await fetchRemoteAudio(new URL('https://example.com/opaque'), {
      filename: 'fallback.wav',
      signal: new AbortController().signal,
    });
    expect(file.name).toBe('server.mp3');
    expect(file.type).toBe('audio/mpeg');
  });

  it('throws aborted when the signal fires before fetch resolves', async () => {
    const controller = new AbortController();
    controller.abort();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    await expect(
      fetchRemoteAudio(new URL('https://example.com/big.wav'), {
        filename: 'big.wav',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ kind: 'aborted' });
  });
});
