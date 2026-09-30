import { OcrError, type ScanPhoto } from "../features/scan/types";
import { createRemoteOcrProvider } from "./remoteOcrProvider";

const mockFile = { exists: true, size: 1_024, base64: jest.fn() };

jest.mock("expo-file-system", () => ({
  File: jest.fn(() => mockFile),
}));

const API_URL = "https://ocr.example.test/ocr";
const CODE = "evaluation-code";
const photo: ScanPhoto = { uri: "file:///scan.jpg", width: 900, height: 1200 };

function respondWith(status: number, body: unknown) {
  return jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

function successBody(requestId: string) {
  return {
    requestId,
    text: "읽은 문장",
    warnings: ["LOW_LIGHT"],
    source: "remote",
  };
}

async function recognize(
  apiUrl: string | undefined = API_URL,
  code = CODE,
  signal = new AbortController().signal,
) {
  return createRemoteOcrProvider(apiUrl, code).recognize({
    photo,
    requestId: "req-1",
    signal,
  });
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OcrError) return error;
    throw error;
  }
  throw new Error("expected OcrError");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFile.exists = true;
  mockFile.size = 1_024;
  mockFile.base64.mockResolvedValue("AAAA");
});

test("성공 응답을 검증해 결과로 돌려준다", async () => {
  global.fetch = respondWith(
    200,
    successBody("req-1"),
  ) as unknown as typeof fetch;

  const result = await recognize();

  expect(result).toEqual({
    requestId: "req-1",
    text: "읽은 문장",
    warnings: ["LOW_LIGHT"],
    source: "remote",
  });
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe(API_URL);
  expect(init.headers.Authorization).toBe(`Bearer ${CODE}`);
  expect(init.redirect).toBe("error");
  expect(JSON.parse(init.body).mimeType).toBe("image/jpeg");
});

test("요청 ID가 다른 응답은 서버 오류로 처리한다", async () => {
  global.fetch = respondWith(
    200,
    successBody("다른-요청"),
  ) as unknown as typeof fetch;

  const error = await codeOf(recognize());

  expect(error.code).toBe("SERVER");
  expect(error.retryable).toBe(true);
});

test("알 수 없는 품질 경고가 오면 결과를 받아들이지 않는다", async () => {
  global.fetch = respondWith(200, {
    ...successBody("req-1"),
    warnings: ["UNKNOWN_DEFECT"],
  }) as unknown as typeof fetch;

  expect((await codeOf(recognize())).code).toBe("SERVER");
});

test("401은 재시도가 아니라 코드 재입력으로 이어진다", async () => {
  global.fetch = respondWith(401, {
    error: {
      code: "UNAUTHORIZED",
      message: "코드를 확인해 주세요.",
      retryable: true,
    },
  }) as unknown as typeof fetch;

  const error = await codeOf(recognize());

  expect(error.code).toBe("UNAUTHORIZED");
  expect(error.retryable).toBe(false);
});

test("429는 재시도할 수 있는 오류로 전달한다", async () => {
  global.fetch = respondWith(429, {}) as unknown as typeof fetch;

  const error = await codeOf(recognize());

  expect(error.code).toBe("RATE_LIMITED");
  expect(error.retryable).toBe(true);
});

test("서버가 재시도 가능하다고 해도 INVALID_IMAGE는 재시도하지 않는다", async () => {
  global.fetch = respondWith(500, {
    error: {
      code: "INVALID_IMAGE",
      message: "사진을 읽을 수 없습니다.",
      retryable: true,
    },
  }) as unknown as typeof fetch;

  const error = await codeOf(recognize());

  expect(error.code).toBe("INVALID_IMAGE");
  expect(error.retryable).toBe(false);
});

test("https가 아닌 주소는 호출 전에 설정 오류로 막는다", async () => {
  global.fetch = respondWith(
    200,
    successBody("req-1"),
  ) as unknown as typeof fetch;

  const error = await codeOf(recognize("http://ocr.example.test/ocr"));

  expect(error.code).toBe("CONFIGURATION");
  expect(error.retryable).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("주소가 비어 있으면 설정 오류로 막는다", async () => {
  global.fetch = respondWith(
    200,
    successBody("req-1"),
  ) as unknown as typeof fetch;

  const request = createRemoteOcrProvider(undefined, CODE).recognize({
    photo,
    requestId: "req-1",
    signal: new AbortController().signal,
  });

  expect((await codeOf(request)).code).toBe("CONFIGURATION");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("코드 형식이 맞지 않으면 파일을 읽지 않고 막는다", async () => {
  global.fetch = respondWith(
    200,
    successBody("req-1"),
  ) as unknown as typeof fetch;

  const error = await codeOf(recognize(API_URL, "코드에 한글과 공백 "));

  expect(error.code).toBe("UNAUTHORIZED");
  expect(mockFile.base64).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("5MB를 넘는 사진은 전송하지 않는다", async () => {
  mockFile.size = 6 * 1024 * 1024;
  global.fetch = respondWith(
    200,
    successBody("req-1"),
  ) as unknown as typeof fetch;

  const error = await codeOf(recognize());

  expect(error.code).toBe("INVALID_IMAGE");
  expect(error.retryable).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("이미 취소된 요청은 파일도 읽지 않는다", async () => {
  const controller = new AbortController();
  controller.abort();
  global.fetch = respondWith(
    200,
    successBody("req-1"),
  ) as unknown as typeof fetch;

  const error = await codeOf(recognize(API_URL, CODE, controller.signal));

  expect(error.code).toBe("CANCELLED");
  expect(error.retryable).toBe(false);
  expect(mockFile.base64).not.toHaveBeenCalled();
});

test("네트워크 실패는 재시도할 수 있는 오류로 바꾼다", async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  }) as unknown as typeof fetch;

  const error = await codeOf(recognize());

  expect(error.code).toBe("NETWORK");
  expect(error.retryable).toBe(true);
});
