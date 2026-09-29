import { File } from "expo-file-system";
import {
  OcrError,
  type OcrErrorCode,
  type OcrProvider,
  type OcrResult,
  type QualityWarning,
} from "../features/scan/types";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const WARNING_CODES = new Set<QualityWarning>([
  "LOW_LIGHT",
  "POSSIBLE_BLUR",
  "GLARE",
  "SMALL_TEXT",
  "CROPPED",
]);
const ERROR_CODES = new Set<OcrErrorCode>([
  "NETWORK",
  "TIMEOUT",
  "SERVER",
  "INVALID_IMAGE",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "CONFIGURATION",
  "CANCELLED",
]);
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkCancellation(signal: AbortSignal) {
  if (signal.aborted)
    throw new OcrError("CANCELLED", "요청을 취소했어요.", false);
}
function validateResult(value: unknown, requestId: string): OcrResult {
  if (
    !isObject(value) ||
    value.requestId !== requestId ||
    value.source !== "remote" ||
    typeof value.text !== "string" ||
    value.text.length > 2_000_000 ||
    !Array.isArray(value.warnings) ||
    value.warnings.length > WARNING_CODES.size ||
    !value.warnings.every(
      (warning: unknown) =>
        typeof warning === "string" &&
        WARNING_CODES.has(warning as QualityWarning),
    )
  ) {
    throw new OcrError(
      "SERVER",
      "서버에서 올바른 인식 결과를 받지 못했어요. 다시 시도해 주세요.",
      true,
    );
  }
  return {
    requestId,
    text: value.text,
    warnings: [...new Set(value.warnings as QualityWarning[])],
    source: "remote",
  };
}
function responseError(status: number, value: unknown): OcrError {
  // HTTP authentication errors must always lead to changing the code, never blind retry.
  if (status === 401 || status === 403)
    return new OcrError(
      "UNAUTHORIZED",
      "평가용 액세스 코드를 확인하고 다시 입력해 주세요.",
      false,
    );
  if (status === 413 || status === 415 || status === 400)
    return new OcrError(
      "INVALID_IMAGE",
      "처리할 수 없는 사진입니다. 용량을 줄이거나 다시 촬영해 주세요.",
      false,
    );
  if (status === 429)
    return new OcrError(
      "RATE_LIMITED",
      "요청이 많아 잠시 기다린 뒤 다시 시도해 주세요.",
      true,
    );
  if (isObject(value) && isObject(value.error)) {
    const error = value.error;
    if (
      typeof error.code === "string" &&
      ERROR_CODES.has(error.code as OcrErrorCode) &&
      typeof error.message === "string" &&
      error.message.trim().length > 0 &&
      error.message.length <= 300 &&
      typeof error.retryable === "boolean"
    ) {
      const code = error.code as OcrErrorCode;
      return new OcrError(
        code,
        error.message,
        code === "UNAUTHORIZED" ||
          code === "INVALID_IMAGE" ||
          code === "CONFIGURATION" ||
          code === "CANCELLED"
          ? false
          : error.retryable,
      );
    }
  }
  return new OcrError(
    status === 504 ? "TIMEOUT" : "SERVER",
    status === 504
      ? "인식 응답이 늦어지고 있어요. 다시 시도해 주세요."
      : "인식 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
    status >= 500,
  );
}
export function createRemoteOcrProvider(
  apiUrl: string | undefined,
  accessCode: string,
): OcrProvider {
  return {
    async recognize({ photo, requestId, signal }) {
      checkCancellation(signal);
      let url: URL;
      try {
        url = new URL(apiUrl ?? "");
        const localDevelopmentEndpoint =
          __DEV__ &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname);
        if (
          (url.protocol !== "https:" && !localDevelopmentEndpoint) ||
          url.username ||
          url.password ||
          url.hash
        )
          throw new Error("Invalid endpoint");
      } catch {
        throw new OcrError(
          "CONFIGURATION",
          "OCR 서버 주소가 설정되지 않았어요. 앱 설정을 확인해 주세요.",
          false,
        );
      }
      if (!/^[\x21-\x7e]{1,256}$/.test(accessCode))
        throw new OcrError(
          "UNAUTHORIZED",
          "평가용 액세스 코드를 다시 입력해 주세요.",
          false,
        );
      let imageBase64: string;
      try {
        const file = new File(photo.uri);
        if (!file.exists || file.size <= 0 || file.size > MAX_FILE_BYTES)
          throw new OcrError(
            "INVALID_IMAGE",
            "사진은 5MB 이하로 전송할 수 있어요. 다시 촬영해 주세요.",
            false,
          );
        // Async native file read; do not use base64Sync on the JS thread.
        imageBase64 = await file.base64();
        checkCancellation(signal);
        if (
          imageBase64.length === 0 ||
          imageBase64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4
        )
          throw new OcrError(
            "INVALID_IMAGE",
            "사진 용량이 너무 커요. 다시 촬영해 주세요.",
            false,
          );
      } catch (error) {
        checkCancellation(signal);
        if (error instanceof OcrError) throw error;
        throw new OcrError(
          "INVALID_IMAGE",
          "사진 파일을 읽지 못했어요. 다시 촬영해 주세요.",
          false,
        );
      }
      try {
        checkCancellation(signal);
        const response = await fetch(url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessCode}`,
          },
          body: JSON.stringify({
            requestId,
            imageBase64,
            mimeType: "image/jpeg",
          }),
          signal,
          redirect: "error",
        });
        checkCancellation(signal);
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          checkCancellation(signal);
          if (!response.ok) throw responseError(response.status, undefined);
          throw new OcrError(
            "SERVER",
            "서버 응답을 읽지 못했어요. 다시 시도해 주세요.",
            true,
          );
        }
        checkCancellation(signal);
        if (!response.ok) throw responseError(response.status, payload);
        return validateResult(payload, requestId);
      } catch (error) {
        checkCancellation(signal);
        if (error instanceof OcrError) throw error;
        throw new OcrError(
          "NETWORK",
          "네트워크 연결을 확인하고 다시 시도해 주세요.",
          true,
        );
      }
    },
  };
}
