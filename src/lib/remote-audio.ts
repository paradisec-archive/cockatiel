const FALLBACK_FILENAME = 'remote-audio.wav';

export type RemoteAudioErrorKind = 'invalid-url' | 'cors' | 'not-found' | 'server-error' | 'network' | 'aborted' | 'unknown';

export class RemoteAudioError extends Error {
  readonly kind: RemoteAudioErrorKind;
  readonly status?: number;

  constructor(kind: RemoteAudioErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'RemoteAudioError';
    this.kind = kind;
    this.status = status;
  }
}

export interface RemoteAudioMeta {
  filename: string;
  size?: number;
}

interface FetchProgress {
  loaded: number;
  total?: number;
  fraction?: number;
}

export interface FetchRemoteAudioOptions {
  filename: string;
  signal: AbortSignal;
  onProgress?: (progress: FetchProgress) => void;
}

export const safeHost = (raw: string): string | null => {
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
};

export const validateUrl = (raw: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new RemoteAudioError('invalid-url', 'Not a valid URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new RemoteAudioError('invalid-url', 'Only https URLs are supported.');
  }
  return parsed;
};

const decodeRfc5987 = (value: string): string => {
  const match = /^([A-Za-z0-9!#$%&+\-^_`{}~]+)'[^']*'(.+)$/.exec(value);
  if (!match) {
    return value;
  }
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return match[2];
  }
};

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return trimmed;
};

export const parseContentDispositionFilename = (header: string | null): string | undefined => {
  if (!header) {
    return undefined;
  }
  const star = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (star) {
    const decoded = decodeRfc5987(star[1].trim());
    if (decoded) {
      return decoded;
    }
  }
  const plain = /filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i.exec(header);
  if (plain) {
    const value = unquote(plain[1]);
    if (value) {
      return value;
    }
  }
  return undefined;
};

export const filenameFromPath = (url: URL): string | undefined => {
  const segments = url.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) {
    return undefined;
  }
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

export const deriveFilename = (url: URL, contentDisposition: string | null): string => {
  return parseContentDispositionFilename(contentDisposition) ?? filenameFromPath(url) ?? FALLBACK_FILENAME;
};

const mapResponseError = (response: Response): RemoteAudioError => {
  if (response.status === 404) {
    return new RemoteAudioError('not-found', 'File not found (404).', 404);
  }
  if (response.status >= 500) {
    return new RemoteAudioError('server-error', `Server error (${response.status}).`, response.status);
  }
  return new RemoteAudioError('unknown', `Request failed (${response.status}).`, response.status);
};

const mapNetworkError = (error: unknown, signal: AbortSignal): RemoteAudioError => {
  if (signal.aborted) {
    return new RemoteAudioError('aborted', 'Cancelled.');
  }
  const message = error instanceof Error ? error.message : '';
  if (error instanceof TypeError) {
    return new RemoteAudioError('cors', `Network or CORS error. The server may not allow cross-origin requests. ${message}`.trim());
  }
  return new RemoteAudioError('network', message || 'Network error.');
};

const parseContentRangeTotal = (header: string | null): number | undefined => {
  if (!header) {
    return undefined;
  }
  // RFC 7233 §4.2: "bytes <start>-<end>/<total>"  (or "/*" if total is unknown).
  const match = /bytes\s+\d+-\d+\/(\d+)/i.exec(header);
  if (!match) {
    return undefined;
  }
  const total = Number(match[1]);
  return Number.isFinite(total) && total > 0 ? total : undefined;
};

export const inspectRemoteAudio = async (url: URL, signal: AbortSignal): Promise<RemoteAudioMeta> => {
  let response: Response;
  try {
    // Range-GET rather than HEAD: signed URLs (e.g. S3 presigned) sign the HTTP
    // method, so HEAD fails signature verification — but a Range request signs
    // identically to the full GET.
    response = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal });
  } catch (error) {
    throw mapNetworkError(error, signal);
  }
  // Release the response body immediately — we only care about headers.
  void response.body?.cancel().catch(() => {});
  if (!response.ok && response.status !== 206) {
    throw mapResponseError(response);
  }
  const total = parseContentRangeTotal(response.headers.get('Content-Range'));
  let size: number | undefined = total;
  if (size === undefined && response.status !== 206) {
    // Server ignored Range and returned the full body — Content-Length is the total.
    const lengthHeader = response.headers.get('Content-Length');
    const length = lengthHeader ? Number(lengthHeader) : undefined;
    size = Number.isFinite(length) && (length ?? 0) > 0 ? length : undefined;
  }
  return {
    filename: deriveFilename(url, response.headers.get('Content-Disposition')),
    size,
  };
};

const inferMimeType = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'flac':
      return 'audio/flac';
    case 'ogg':
    case 'oga':
      return 'audio/ogg';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'wma':
      return 'audio/x-ms-wma';
    default:
      return 'application/octet-stream';
  }
};

export const fetchRemoteAudio = async (url: URL, opts: FetchRemoteAudioOptions): Promise<File> => {
  const { filename, signal, onProgress } = opts;
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    throw mapNetworkError(error, signal);
  }
  if (!response.ok) {
    throw mapResponseError(response);
  }

  const headerFilename = parseContentDispositionFilename(response.headers.get('Content-Disposition'));
  const effectiveFilename = headerFilename ?? filename;
  const lengthHeader = response.headers.get('Content-Length');
  const total = lengthHeader ? Number(lengthHeader) : undefined;
  const knownTotal = Number.isFinite(total) && (total ?? 0) > 0 ? total : undefined;

  const body = response.body;
  if (!body) {
    const buffer = await response.arrayBuffer();
    onProgress?.({ fraction: 1, loaded: buffer.byteLength, total: knownTotal });
    return new File([buffer], effectiveFilename, { type: inferMimeType(effectiveFilename) });
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      loaded += value.byteLength;
      const fraction = knownTotal ? Math.min(loaded / knownTotal, 0.999) : undefined;
      onProgress?.({ fraction, loaded, total: knownTotal });
    }
  } catch (error) {
    throw mapNetworkError(error, signal);
  }

  onProgress?.({ fraction: 1, loaded, total: knownTotal ?? loaded });
  return new File(chunks as BlobPart[], effectiveFilename, { type: inferMimeType(effectiveFilename) });
};

export const formatRemoteAudioError = (error: unknown): string => {
  if (error instanceof RemoteAudioError) {
    switch (error.kind) {
      case 'invalid-url':
        return error.message;
      case 'cors':
        return 'Could not fetch the URL — the server does not allow cross-origin access.';
      case 'not-found':
        return 'File not found (404).';
      case 'server-error':
        return `The server returned an error (${error.status ?? '5xx'}).`;
      case 'network':
        return 'Network error while downloading.';
      case 'aborted':
        return 'Download cancelled.';
      default:
        return error.message || 'Could not download the file.';
    }
  }
  return error instanceof Error ? error.message : 'Could not download the file.';
};
