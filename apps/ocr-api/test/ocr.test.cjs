const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { http } = require('@google-cloud/functions-framework');
const { getTestServer } = require('@google-cloud/functions-framework/testing');
const { CallSettings } = require('google-gax');
const { createOcrHandler, MAX_IMAGE_BYTES, MAX_JSON_BYTES, OCR_DEADLINE_MS } = require('../dist/handler.js');
const { qualityWarnings } = require('../dist/quality.js');

const accessToken = 'local-test-access-code-only';
const configuration = {
  project: 'artinus-ocr',
  location: 'us',
  processorId: '73989430d5ede014',
  accessToken,
};
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const body = { requestId: 'local-request-1', imageBase64: jpeg.toString('base64'), mimeType: 'image/jpeg' };
let nextServerId = 0;

async function serverFor(t, dependencies = {}) {
  const name = `ocr-test-${++nextServerId}`;
  http(name, createOcrHandler({ configuration, processDocument: async () => ({ document: { text: '인식한 문장' } }), ...dependencies }));
  const server = getTestServer(name);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    get: (path) => fetch(`${origin}${path}`),
    post: (input = body, headers = {}) => fetch(origin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...headers },
      body: JSON.stringify(input),
    }),
  };
}

test('authentication fails closed and health exposes only liveness', async (t) => {
  let calls = 0;
  const api = await serverFor(t, { processDocument: async () => { calls += 1; return { document: {} }; } });
  for (const authorization of ['', 'Bearer wrong-code', 'Basic local-test-access-code-only']) {
    const response = await api.post(body, { Authorization: authorization });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: { code: 'UNAUTHORIZED', message: '접근 코드를 확인해 주세요.', retryable: false } });
  }
  assert.equal(calls, 0);
  const unconfigured = await serverFor(t, { configuration: { ...configuration, accessToken: '' }, processDocument: async () => { calls += 1; return { document: {} }; } });
  const failure = await unconfigured.post();
  assert.equal(failure.status, 500);
  assert.equal((await failure.json()).error.code, 'CONFIGURATION');
  const health = await unconfigured.get('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal(calls, 0);
});

test('HTTP success preserves request id and sends bounded non-retrying OCR options', async (t) => {
  let captured;
  const api = await serverFor(t, {
    configuration: { ...configuration, processorVersion: 'pretrained-ocr-v2.1-2024-08-07' },
    processDocument: async (request, options) => {
      captured = { request, options };
      return { document: { text: '원본의 인식 결과\n두 번째 줄', pages: [{ imageQualityScores: { detectedDefects: [{ type: 'quality/defect_dark', confidence: 0.5 }] } }] } };
    },
  });
  const response = await api.post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { requestId: body.requestId, text: '원본의 인식 결과\n두 번째 줄', warnings: ['LOW_LIGHT'], source: 'remote' });
  assert.equal(captured.request.name, 'projects/artinus-ocr/locations/us/processors/73989430d5ede014/processorVersions/pretrained-ocr-v2.1-2024-08-07');
  assert.deepEqual(captured.request.rawDocument, { content: jpeg, mimeType: 'image/jpeg' });
  assert.deepEqual(captured.request.processOptions, { ocrConfig: { enableImageQualityScores: true } });
  assert.equal(captured.request.imagelessMode, true);
  assert.deepEqual(captured.request.fieldMask, { paths: ['text', 'pages.image_quality_scores'] });
  assert.deepEqual(captured.options, { timeout: OCR_DEADLINE_MS, retry: null });
  const empty = await serverFor(t, { processDocument: async () => ({ document: {} }) });
  const emptyResponse = await empty.post();
  assert.equal(emptyResponse.status, 200);
  assert.deepEqual(await emptyResponse.json(), { requestId: body.requestId, text: '', warnings: [], source: 'remote' });
});

test('actual SDK CallSettings accepts the handler no-retry options', async (t) => {
  const defaults = new CallSettings({ timeout: 30_000 });
  let merged;
  const api = await serverFor(t, { processDocument: async (_request, options) => {
    // retry:null disables retry; adding maxRetries makes google-gax dereference null.
    merged = defaults.merge(options);
    return { document: {} };
  } });
  assert.equal((await api.post()).status, 200);
  assert.equal(merged.retry, null);
  assert.equal(merged.timeout, OCR_DEADLINE_MS);
});

test('invalid input never invokes OCR and size limits include decoded and JSON boundaries', async (t) => {
  let calls = 0;
  const api = await serverFor(t, { processDocument: async () => { calls += 1; return { document: {} }; } });
  for (const [input, status] of [
    [{ ...body, requestId: '' }, 400],
    [{ ...body, requestId: 'x'.repeat(129) }, 400],
    [{ ...body, mimeType: 'image/png' }, 415],
    [{ ...body, imageBase64: '@@@=' }, 400],
    [{ ...body, imageBase64: '/9j/2R==' }, 400],
    [{ ...body, imageBase64: Buffer.from('not a jpeg').toString('base64') }, 415],
  ]) {
    const response = await api.post(input);
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.retryable, false);
  }
  const wrongType = await api.post(body, { 'Content-Type': 'text/plain' });
  assert.equal(wrongType.status, 415);
  const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1);
  jpeg.copy(oversized);
  const tooLarge = await api.post({ ...body, imageBase64: oversized.toString('base64') });
  assert.equal(tooLarge.status, 413);
  const tooMuchJson = await api.post({ ...body, padding: 'x'.repeat(MAX_JSON_BYTES) });
  assert.equal(tooMuchJson.status, 413);
  assert.equal(calls, 0);
  const exactLimit = oversized.subarray(0, MAX_IMAGE_BYTES);
  const accepted = await api.post({ ...body, imageBase64: exactLimit.toString('base64') });
  assert.equal(accepted.status, 200);
  assert.equal(calls, 1);
});

test('quality mapping covers supported defects, deduplicates pages, and uses inclusive 0.5', () => {
  const warnings = qualityWarnings({ pages: [
    { imageQualityScores: { qualityScore: 0.9, detectedDefects: [
      { type: 'quality/defect_dark', confidence: 0.5 },
      { type: 'quality/defect_blurry', confidence: 0.499999 },
      { type: 'quality/defect_glare', confidence: 1 },
      { type: 'quality/defect_text_too_small', confidence: 0.75 },
      { type: 'quality/defect_document_cutoff', confidence: 0.6 },
      { type: 'quality/defect_text_cutoff', confidence: 0.5 },
      { type: 'quality/defect_noisy', confidence: 1 },
      { type: 'quality/defect_faint', confidence: 1 },
    ] } },
    { imageQualityScores: { detectedDefects: [{ type: 'quality/defect_blurry', confidence: 1 }] } },
  ] });
  assert.deepEqual(warnings, ['LOW_LIGHT', 'POSSIBLE_BLUR', 'GLARE', 'SMALL_TEXT', 'CROPPED']);
  assert.deepEqual(qualityWarnings({ pages: [{ imageQualityScores: { detectedDefects: [
    { type: 'quality/defect_dark', confidence: 0.499999 },
    { type: 'quality/defect_dark', confidence: -1 },
    { type: 'quality/defect_dark', confidence: 1.01 },
    { type: 'quality/defect_dark', confidence: NaN },
    { type: 'quality/defect_dark' },
  ] } }] }), []);
});

test('rate window is global per handler and resets at its boundary', async (t) => {
  let timestamp = 0;
  let calls = 0;
  const api = await serverFor(t, { now: () => timestamp, processDocument: async () => { calls += 1; return { document: {} }; } });
  for (let index = 0; index < 10; index += 1) assert.equal((await api.post()).status, 200);
  const limited = await api.post();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal(calls, 10);
  timestamp = 60_000;
  assert.equal((await api.post()).status, 200);
  assert.equal(calls, 11);
});

test('only two OCR calls run together and completed calls release capacity', async (t) => {
  const pending = [];
  const api = await serverFor(t, { processDocument: () => new Promise((resolve) => pending.push(resolve)) });
  const first = api.post();
  const second = api.post();
  const limit = Date.now() + 2000;
  while (pending.length < 2 && Date.now() < limit) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 2);
  const rejected = await api.post();
  assert.equal(rejected.status, 429);
  assert.equal(rejected.headers.get('retry-after'), '1');
  assert.equal(pending.length, 2);
  pending[0]({ document: {} });
  pending[1]({ document: {} });
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  const third = api.post();
  while (pending.length < 3 && Date.now() < limit) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 3);
  pending[2]({ document: {} });
  assert.equal((await third).status, 200);
});

test('upstream errors have safe messages and keep retry decisions separate', async (t) => {
  for (const [code, status, expectedCode, retryable] of [
    [4, 504, 'TIMEOUT', true],
    [8, 429, 'RATE_LIMITED', true],
    [7, 500, 'CONFIGURATION', false],
    [3, 400, 'INVALID_IMAGE', false],
    [14, 502, 'SERVER', true],
  ]) {
    const api = await serverFor(t, { processDocument: async () => { throw Object.assign(new Error(`sensitive ${accessToken} ${body.imageBase64}`), { code }); } });
    const response = await api.post();
    assert.equal(response.status, status);
    const result = await response.json();
    assert.equal(result.error.code, expectedCode);
    assert.equal(result.error.retryable, retryable);
    assert.equal(JSON.stringify(result).includes(accessToken), false);
    assert.equal(JSON.stringify(result).includes(body.imageBase64), false);
  }
  const malformedResult = await serverFor(t, { processDocument: async () => ({}) });
  assert.equal((await malformedResult.post()).status, 502);
});
