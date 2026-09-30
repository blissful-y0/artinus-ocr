import { OcrError, type OcrProvider } from "../features/scan/types";

// Intentionally fail closed until server authentication and response mapping are verified.
// Public URL configuration alone must not make an unauthenticated paid OCR request.
export const remoteOcrProvider: OcrProvider = {
  async recognize() {
    throw new OcrError(
      "CONFIGURATION",
      "실제 OCR 연결을 준비 중입니다. 현재 빌드에서는 모의 모드를 사용해 주세요.",
      false,
    );
  },
};
