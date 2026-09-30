import { File } from "expo-file-system";
import {
  OcrError,
  type OcrErrorCode,
  type OcrProvider,
  type OcrResult,
  type QualityWarning,
} from "../features/scan/types";
import { MAX_UPLOAD_BYTES } from "../features/scan/constants";
import { REMOTE_MESSAGES } from "../features/scan/messages";

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
    throw new OcrError("CANCELLED", REMOTE_MESSAGES.cancelled, false);
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
    throw new OcrError("SERVER", REMOTE_MESSAGES.invalidResult, true);
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
    return new OcrError("UNAUTHORIZED", REMOTE_MESSAGES.unauthorized, false);
  if (status === 413 || status === 415 || status === 400)
    return new OcrError("INVALID_IMAGE", REMOTE_MESSAGES.rejectedImage, false);
  if (status === 429)
    return new OcrError("RATE_LIMITED", REMOTE_MESSAGES.rateLimited, true);
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
      ? REMOTE_MESSAGES.gatewayTimeout
      : REMOTE_MESSAGES.serverFailure,
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
          REMOTE_MESSAGES.missingEndpoint,
          false,
        );
      }
      if (!/^[\x21-\x7e]{1,256}$/.test(accessCode))
        throw new OcrError(
          "UNAUTHORIZED",
          REMOTE_MESSAGES.malformedAccessCode,
          false,
        );
      let imageBase64: string;
      try {
        const file = new File(photo.uri);
        if (!file.exists || file.size <= 0 || file.size > MAX_UPLOAD_BYTES)
          throw new OcrError(
            "INVALID_IMAGE",
            REMOTE_MESSAGES.oversizeFile,
            false,
          );
        // Async native file read; do not use base64Sync on the JS thread.
        imageBase64 = await file.base64();
        checkCancellation(signal);
        if (
          imageBase64.length === 0 ||
          imageBase64.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4
        )
          throw new OcrError(
            "INVALID_IMAGE",
            REMOTE_MESSAGES.oversizePayload,
            false,
          );
      } catch (error) {
        checkCancellation(signal);
        if (error instanceof OcrError) throw error;
        throw new OcrError(
          "INVALID_IMAGE",
          REMOTE_MESSAGES.unreadableFile,
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
            REMOTE_MESSAGES.unreadableResponse,
            true,
          );
        }
        checkCancellation(signal);
        if (!response.ok) throw responseError(response.status, payload);
        return validateResult(payload, requestId);
      } catch (error) {
        checkCancellation(signal);
        if (error instanceof OcrError) throw error;
        throw new OcrError("NETWORK", REMOTE_MESSAGES.networkFailure, true);
      }
    },
  };
}
