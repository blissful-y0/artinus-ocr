import { OcrError } from "../features/scan/types";
import { MOCK_MESSAGES } from "../features/scan/messages";
import type {
  MockScenario,
  OcrProvider,
  OcrResult,
} from "../features/scan/types";

export const MOCK_SCENARIOS: { value: MockScenario; label: string }[] = [
  { value: "success", label: "인식 성공" },
  { value: "empty", label: "텍스트 없음" },
  { value: "quality", label: "품질 경고" },
  { value: "error", label: "실패 후 재시도" },
  { value: "slow", label: "느린 응답" },
  { value: "timeout", label: "시간 초과" },
  { value: "late", label: "취소 후 늦은 응답" },
];

const SAMPLE_TEXT =
  "오늘의 작은 기록\n\n천천히 읽고, 새롭게 발견하세요.\n한 줄의 문장이 새로운 생각으로 이어집니다.\n\n2026년 9월 28일";

const RESPONSE_DELAY_MS: Record<MockScenario, number> = {
  success: 900,
  empty: 900,
  quality: 900,
  error: 900,
  slow: 6000,
  timeout: 15000,
  late: 8000,
};

function waitForResponse(
  milliseconds: number,
  signal: AbortSignal,
  ignoreAbort: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancelled = () =>
      new OcrError("CANCELLED", MOCK_MESSAGES.cancelled, false);
    if (!ignoreAbort && signal.aborted) {
      reject(cancelled());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      if (!ignoreAbort) signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);

    if (!ignoreAbort) signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function createMockOcrProvider(scenario: MockScenario): OcrProvider {
  const failedPhotoUris = new Set<string>();

  return {
    async recognize({ photo, requestId, signal }): Promise<OcrResult> {
      // The late scenario simulates server work that continues after client cancellation.
      // Its timer still settles in eight seconds; every other scenario clears timers on abort.
      await waitForResponse(
        RESPONSE_DELAY_MS[scenario],
        signal,
        scenario === "late",
      );

      if (scenario === "timeout") {
        // The app times mock requests out at ten seconds. This also fails predictably
        // if a caller does not apply its own timeout.
        throw new OcrError("TIMEOUT", MOCK_MESSAGES.timeout, true);
      }

      if (scenario === "error" && !failedPhotoUris.has(photo.uri)) {
        failedPhotoUris.add(photo.uri);
        throw new OcrError("NETWORK", MOCK_MESSAGES.transientFailure, true);
      }

      return {
        requestId,
        text: scenario === "empty" ? "" : SAMPLE_TEXT,
        warnings:
          scenario === "quality"
            ? ["LOW_LIGHT", "POSSIBLE_BLUR", "GLARE", "SMALL_TEXT", "CROPPED"]
            : [],
        source: "mock",
      };
    },
  };
}
