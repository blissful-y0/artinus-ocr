import { act, renderHook, waitFor } from "@testing-library/react-native";
import { deletePhoto, preparePhoto } from "../../services/photoFiles";
import { OcrError, type OcrProvider, type ScanPhoto } from "./types";
import { useScan } from "./useScan";

jest.mock("../../services/photoFiles", () => ({
  preparePhoto: jest.fn(),
  deletePhoto: jest.fn(),
  initializePhotoFiles: jest.fn(),
}));

const prepare = preparePhoto as jest.MockedFunction<typeof preparePhoto>;
const remove = deletePhoto as jest.MockedFunction<typeof deletePhoto>;

const photo: ScanPhoto = {
  uri: "file:///scan-1.jpg",
  width: 900,
  height: 1200,
};
const other: ScanPhoto = {
  uri: "file:///scan-2.jpg",
  width: 900,
  height: 1200,
};

type Recognized = {
  requestId: string;
  text: string;
  warnings: [];
  source: "mock";
};

function recognized(requestId: string, text: string): Recognized {
  return { requestId, text, warnings: [], source: "mock" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolveWith, rejectWith) => {
    resolve = resolveWith;
    reject = rejectWith;
  });
  return { promise, resolve, reject };
}

function mount(provider: OcrProvider, timeoutMs = 10_000) {
  return renderHook(() => useScan(provider, timeoutMs));
}

beforeEach(() => {
  jest.clearAllMocks();
  prepare.mockImplementation(async (taken) => taken);
  remove.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test("촬영은 processing을 거쳐 success로 끝난다", async () => {
  const provider: OcrProvider = {
    recognize: jest.fn(async ({ requestId }) =>
      recognized(requestId, "읽은 문장"),
    ),
  };
  const { result } = await mount(provider);

  await act(() => result.current.capture(async () => photo));
  await waitFor(() => expect(result.current.state.status).toBe("success"));

  const state = result.current.state;
  if (state.status !== "success") throw new Error("expected success");
  expect(state.result.text).toBe("읽은 문장");
  expect(state.photo.uri).toBe(photo.uri);
  expect(provider.recognize).toHaveBeenCalledTimes(1);
});

test("재촬영으로 취소한 요청의 늦은 응답은 화면에 반영하지 않는다", async () => {
  const pending = deferred<Recognized>();
  let seenRequestId = "";
  const provider: OcrProvider = {
    recognize: jest.fn(({ requestId }) => {
      seenRequestId = requestId;
      return pending.promise;
    }),
  };
  const { result } = await mount(provider);

  await act(() => result.current.capture(async () => photo));
  await waitFor(() => expect(result.current.state.status).toBe("processing"));

  await act(async () => result.current.retake());
  expect(result.current.state.status).toBe("camera");

  await act(async () => {
    pending.resolve(recognized(seenRequestId, "늦게 도착한 문장"));
    await pending.promise;
  });

  expect(result.current.state.status).toBe("camera");
});

test("취소한 요청의 사진은 제공자가 끝난 뒤에 지운다", async () => {
  const pending = deferred<Recognized>();
  const provider: OcrProvider = { recognize: jest.fn(() => pending.promise) };
  const { result } = await mount(provider);

  await act(() => result.current.capture(async () => photo));
  await waitFor(() => expect(result.current.state.status).toBe("processing"));

  await act(async () => result.current.retake());
  expect(remove).not.toHaveBeenCalled();

  await act(async () => {
    pending.reject(new OcrError("CANCELLED", "취소했어요.", false));
    await pending.promise.catch(() => undefined);
  });

  await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  expect(remove).toHaveBeenCalledWith(photo);
});

test("재시도 가능한 오류는 같은 사진으로 다시 인식한다", async () => {
  const recognize = jest
    .fn<Promise<Recognized>, [{ requestId: string; photo: ScanPhoto }]>()
    .mockRejectedValueOnce(new OcrError("SERVER", "서버 오류예요.", true))
    .mockImplementation(async ({ requestId }) =>
      recognized(requestId, "두 번째"),
    );
  const provider = { recognize } as unknown as OcrProvider;
  const { result } = await mount(provider);

  await act(() => result.current.capture(async () => photo));
  await waitFor(() => expect(result.current.state.status).toBe("error"));

  await act(async () => result.current.retry());
  await waitFor(() => expect(result.current.state.status).toBe("success"));

  const state = result.current.state;
  if (state.status !== "success") throw new Error("expected success");
  expect(state.photo.uri).toBe(photo.uri);
  expect(recognize).toHaveBeenCalledTimes(2);
  expect(recognize.mock.calls[1]?.[0].photo.uri).toBe(photo.uri);
  expect(remove).not.toHaveBeenCalled();
});

test("재시도할 수 없는 오류에서는 retry가 아무 일도 하지 않는다", async () => {
  const provider: OcrProvider = {
    recognize: jest
      .fn()
      .mockRejectedValue(
        new OcrError("UNAUTHORIZED", "코드를 확인해 주세요.", false),
      ),
  };
  const { result } = await mount(provider);

  await act(() => result.current.capture(async () => photo));
  await waitFor(() => expect(result.current.state.status).toBe("error"));

  await act(async () => result.current.retry());

  expect(result.current.state.status).toBe("error");
  expect(provider.recognize).toHaveBeenCalledTimes(1);
});

test("제한 시간을 넘기면 TIMEOUT 오류를 내고 요청을 중단한다", async () => {
  let signal: AbortSignal | undefined;
  const provider: OcrProvider = {
    recognize: jest.fn((request) => {
      signal = request.signal;
      return new Promise<Recognized>(() => undefined);
    }),
  };
  jest.useFakeTimers();
  const { result } = await mount(provider, 5_000);

  await act(() => result.current.capture(async () => photo));
  expect(result.current.state.status).toBe("processing");

  await act(async () => {
    jest.advanceTimersByTime(5_000);
  });

  const state = result.current.state;
  if (state.status !== "error") throw new Error("expected error");
  expect(state.error.code).toBe("TIMEOUT");
  expect(state.error.retryable).toBe(true);
  expect(signal?.aborted).toBe(true);
});

test("사진 준비에 실패하면 카메라로 돌아가 오류를 알린다", async () => {
  prepare.mockRejectedValue(new Error("manipulator failed"));
  const provider: OcrProvider = { recognize: jest.fn() };
  const { result } = await mount(provider);

  await act(() => result.current.capture(async () => photo));

  const state = result.current.state;
  if (state.status !== "camera") throw new Error("expected camera");
  expect(state.captureError).toBeDefined();
  expect(provider.recognize).not.toHaveBeenCalled();
});

test("처리 중 새로 촬영하면 이전 사진을 정리하고 새 요청만 남는다", async () => {
  const first = deferred<Recognized>();
  const recognize = jest
    .fn<Promise<Recognized>, [{ requestId: string }]>()
    .mockImplementationOnce(() => first.promise)
    .mockImplementation(async ({ requestId }) =>
      recognized(requestId, "새 사진"),
    );
  const provider = { recognize } as unknown as OcrProvider;
  const { result } = await mount(provider);

  await act(() => result.current.capture(async () => photo));
  await waitFor(() => expect(result.current.state.status).toBe("processing"));

  await act(async () => result.current.retake());
  await act(() => result.current.capture(async () => other));
  await act(async () => {
    first.resolve(recognized("stale", "이전 사진"));
    await first.promise;
  });

  await waitFor(() => expect(result.current.state.status).toBe("success"));
  const state = result.current.state;
  if (state.status !== "success") throw new Error("expected success");
  expect(state.photo.uri).toBe(other.uri);
  expect(state.result.text).toBe("새 사진");
  await waitFor(() => expect(remove).toHaveBeenCalledWith(photo));
});
