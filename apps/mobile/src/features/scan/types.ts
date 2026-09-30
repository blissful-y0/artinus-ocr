export type ScanPhoto = { uri: string; width: number; height: number };
export type QualityWarning =
  | "LOW_LIGHT"
  | "POSSIBLE_BLUR"
  | "GLARE"
  | "SMALL_TEXT"
  | "CROPPED";
export type MockScenario =
  | "success"
  | "empty"
  | "quality"
  | "error"
  | "slow"
  | "timeout"
  | "late";
export type OcrResult = {
  requestId: string;
  text: string;
  warnings: QualityWarning[];
  source: "mock" | "remote";
};
export type OcrErrorCode =
  | "NETWORK"
  | "TIMEOUT"
  | "SERVER"
  | "INVALID_IMAGE"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "CONFIGURATION"
  | "CANCELLED";
export class OcrError extends Error {
  constructor(
    public code: OcrErrorCode,
    message: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "OcrError";
  }
}
export type OcrRequest = {
  photo: ScanPhoto;
  requestId: string;
  signal: AbortSignal;
};
export interface OcrProvider {
  recognize(request: OcrRequest): Promise<OcrResult>;
}
export type ScanState =
  | { status: "camera"; captureError?: string }
  | { status: "capturing" }
  | { status: "processing"; photo: ScanPhoto; requestId: string }
  | { status: "success"; photo: ScanPhoto; result: OcrResult }
  | { status: "error"; photo: ScanPhoto; error: OcrError };
export type ResultState = Exclude<
  ScanState,
  { status: "camera" } | { status: "capturing" }
>;
export type ResultScreenProps = {
  state: ResultState;
  onRetake: () => void;
  onRetry: () => void;
  mockMode: boolean;
};
