import { createHash, timingSafeEqual } from 'node:crypto';
import type { HttpFunction, Request, Response } from '@google-cloud/functions-framework';
import { v1, type protos } from '@google-cloud/documentai';
import { isConfigured, processorName, readConfiguration, type OcrConfiguration } from './config';
import { qualityWarnings } from './quality';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_JSON_BYTES = 7 * 1024 * 1024;
export const OCR_DEADLINE_MS = 25_000;
const maxBase64Length = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const quotaWindowMs = 60_000;
const requestsPerWindow = 10;
const concurrentRequests = 2;

export type ProcessDocument = (
  request: protos.google.cloud.documentai.v1.IProcessRequest,
  options: { timeout: number; retry: null },
) => Promise<protos.google.cloud.documentai.v1.IProcessResponse>;

type ErrorCode = 'INVALID_IMAGE' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'CONFIGURATION' | 'SERVER' | 'TIMEOUT';
function fail(response: Response, status: number, code: ErrorCode, message: string, retryable: boolean): void {
  response.status(status).json({ error: { code, message, retryable } });
}

function authorize(request: Request, expectedHash: Buffer): boolean {
  const header = request.get('authorization') ?? '';
  const token = /^Bearer ([^\s]+)$/i.exec(header)?.[1] ?? '';
  const suppliedHash = createHash('sha256').update(token).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

function requestIsTooLarge(request: Request): boolean {
  const contentLength = Number(request.get('content-length') ?? 0);
  return (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES)
    || (request.rawBody?.byteLength ?? 0) > MAX_JSON_BYTES;
}

function decodeImage(response: Response, body: unknown): { requestId: string; content: Buffer } | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    fail(response, 400, 'INVALID_IMAGE', '사진 요청 형식을 확인해 주세요.', false);
    return;
  }
  const input = body as Record<string, unknown>;
  if (typeof input.requestId !== 'string' || input.requestId.length === 0 || input.requestId.length > 128) {
    fail(response, 400, 'INVALID_IMAGE', '요청 식별자가 올바르지 않습니다.', false);
    return;
  }
  if (input.mimeType !== 'image/jpeg') {
    fail(response, 415, 'INVALID_IMAGE', 'JPEG 사진만 처리할 수 있습니다.', false);
    return;
  }
  if (typeof input.imageBase64 !== 'string' || input.imageBase64.length === 0) {
    fail(response, 400, 'INVALID_IMAGE', '사진 데이터가 없습니다. 다시 촬영해 주세요.', false);
    return;
  }
  if (input.imageBase64.length > maxBase64Length) {
    fail(response, 413, 'INVALID_IMAGE', '사진 크기는 5MiB 이하여야 합니다.', false);
    return;
  }
  if (input.imageBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.imageBase64)) {
    fail(response, 400, 'INVALID_IMAGE', '사진 데이터 형식이 올바르지 않습니다.', false);
    return;
  }
  const content = Buffer.from(input.imageBase64, 'base64');
  if (content.toString('base64') !== input.imageBase64) {
    fail(response, 400, 'INVALID_IMAGE', '사진 데이터 형식이 올바르지 않습니다.', false);
    return;
  }
  if (content.length > MAX_IMAGE_BYTES) {
    fail(response, 413, 'INVALID_IMAGE', '사진 크기는 5MiB 이하여야 합니다.', false);
    return;
  }
  if (content.length < 4 || content[0] !== 0xff || content[1] !== 0xd8 || content[2] !== 0xff) {
    fail(response, 415, 'INVALID_IMAGE', 'JPEG 사진이 아닙니다. 다시 촬영해 주세요.', false);
    return;
  }
  return { requestId: input.requestId, content };
}

function upstreamFailure(response: Response, error: unknown): void {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  switch (code) {
    case 4:
      fail(response, 504, 'TIMEOUT', '인식 시간이 초과되었습니다. 다시 시도해 주세요.', true);
      break;
    case 8:
      response.set('Retry-After', '60');
      fail(response, 429, 'RATE_LIMITED', '요청이 많습니다. 잠시 후 다시 시도해 주세요.', true);
      break;
    case 3:
      fail(response, 400, 'INVALID_IMAGE', '사진을 읽을 수 없습니다. 다시 촬영해 주세요.', false);
      break;
    case 5:
    case 7:
    case 9:
    case 16:
      fail(response, 500, 'CONFIGURATION', 'OCR 서비스 설정을 확인해야 합니다.', false);
      break;
    default:
      fail(response, 502, 'SERVER', '인식 서비스에 연결하지 못했습니다. 다시 시도해 주세요.', true);
  }
}

function documentAiProcessor(configuration: OcrConfiguration): ProcessDocument {
  // No key file or API key: the attached runtime service account supplies ADC.
  let client: v1.DocumentProcessorServiceClient | undefined;
  return async (request, options) => {
    client ??= new v1.DocumentProcessorServiceClient({ apiEndpoint: `${configuration.location}-documentai.googleapis.com` });
    const [response] = await client.processDocument(request, options);
    return response;
  };
}

export function createOcrHandler(dependencies: {
  configuration?: OcrConfiguration;
  processDocument?: ProcessDocument;
  now?: () => number;
} = {}): HttpFunction {
  const configuration = dependencies.configuration ?? readConfiguration();
  const configured = isConfigured(configuration);
  const expectedHash = createHash('sha256').update(configuration.accessToken).digest();
  const processDocument = dependencies.processDocument ?? documentAiProcessor(configuration);
  const now = dependencies.now ?? Date.now;
  let acceptedAt: number[] = [];
  let inFlight = 0;

  return async (request, response) => {
    response.set('Cache-Control', 'no-store');
    response.set('X-Content-Type-Options', 'nosniff');
    if (request.method === 'GET' && request.path === '/health') {
      response.status(200).json({ ok: true });
      return;
    }
    if (request.path !== '/' && request.path !== '/ocr') {
      fail(response, 404, 'SERVER', '요청 경로를 확인해 주세요.', false);
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST');
      fail(response, 405, 'SERVER', 'POST 요청만 지원합니다.', false);
      return;
    }
    if (!configured) {
      fail(response, 500, 'CONFIGURATION', 'OCR 서비스 연결이 설정되지 않았습니다.', false);
      return;
    }
    if (!authorize(request, expectedHash)) {
      fail(response, 401, 'UNAUTHORIZED', '접근 코드를 확인해 주세요.', false);
      return;
    }
    if (requestIsTooLarge(request)) {
      fail(response, 413, 'INVALID_IMAGE', '요청 크기는 7MiB 이하여야 합니다.', false);
      return;
    }
    if (!request.is('application/json') || request.get('content-encoding')) {
      fail(response, 415, 'INVALID_IMAGE', '압축하지 않은 JSON 요청만 지원합니다.', false);
      return;
    }
    const image = decodeImage(response, request.body);
    if (!image) return;
    const timestamp = now();
    acceptedAt = acceptedAt.filter((accepted) => accepted > timestamp - quotaWindowMs);
    if (inFlight >= concurrentRequests || acceptedAt.length >= requestsPerWindow) {
      const retryAfter = inFlight >= concurrentRequests ? 1 : Math.max(1, Math.ceil(((acceptedAt[0] ?? timestamp) + quotaWindowMs - timestamp) / 1000));
      response.set('Retry-After', String(retryAfter));
      fail(response, 429, 'RATE_LIMITED', '요청이 많습니다. 잠시 후 다시 시도해 주세요.', true);
      return;
    }
    acceptedAt.push(timestamp);
    inFlight += 1;
    try {
      const result = await processDocument({
        name: processorName(configuration),
        rawDocument: { content: image.content, mimeType: 'image/jpeg' },
        processOptions: { ocrConfig: { enableImageQualityScores: true } },
        imagelessMode: true,
        fieldMask: { paths: ['text', 'pages.image_quality_scores'] },
      }, { timeout: OCR_DEADLINE_MS, retry: null });
      const document = result.document;
      if (!document || (document.text != null && typeof document.text !== 'string')) {
        fail(response, 502, 'SERVER', '인식 결과를 확인할 수 없습니다. 다시 시도해 주세요.', true);
        return;
      }
      if (document.error?.code) {
        upstreamFailure(response, document.error);
        return;
      }
      response.status(200).json({ requestId: image.requestId, text: document.text ?? '', warnings: qualityWarnings(document), source: 'remote' });
    } catch (error) {
      // Do not log or return SDK errors: they may contain request details.
      upstreamFailure(response, error);
    } finally {
      inFlight -= 1;
    }
  };
}
