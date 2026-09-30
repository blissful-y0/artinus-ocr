// Every message the user can read when something goes wrong. Collected here so
// the same failure cannot be described two different ways in two files, and so
// translating the app later touches one module.

export const CAPTURE_MESSAGES = {
  permissionRequestFailed:
    "카메라 권한을 요청하지 못했어요. 다시 시도해 주세요.",
  permissionCheckFailed: "카메라 권한을 확인하지 못했어요.",
  openSettingsFailed: "설정 앱에서 카메라 권한을 허용해 주세요.",
  cameraMountFailed:
    "카메라를 열지 못했어요. 다른 앱의 카메라 사용을 종료하고 다시 시도해 주세요.",
  photoPrepareFailed: "사진을 준비하지 못했어요. 다시 촬영해 주세요.",
  storageSetupFailed: "임시 사진 저장 공간을 준비하지 못했어요.",
} as const;

export const SCAN_MESSAGES = {
  timeout: "응답이 늦어지고 있어요. 같은 사진으로 다시 시도해 주세요.",
  unknownFailure: "연결을 확인하고 다시 시도해 주세요.",
} as const;

export const REMOTE_MESSAGES = {
  cancelled: "요청을 취소했어요.",
  invalidResult:
    "서버에서 올바른 인식 결과를 받지 못했어요. 다시 시도해 주세요.",
  unreadableResponse: "서버 응답을 읽지 못했어요. 다시 시도해 주세요.",
  unauthorized: "평가용 액세스 코드를 확인하고 다시 입력해 주세요.",
  malformedAccessCode: "평가용 액세스 코드를 다시 입력해 주세요.",
  missingEndpoint:
    "OCR 서버 주소가 설정되지 않았어요. 앱 설정을 확인해 주세요.",
  rejectedImage:
    "처리할 수 없는 사진입니다. 용량을 줄이거나 다시 촬영해 주세요.",
  oversizeFile: "사진은 5MB 이하로 전송할 수 있어요. 다시 촬영해 주세요.",
  oversizePayload: "사진 용량이 너무 커요. 다시 촬영해 주세요.",
  unreadableFile: "사진 파일을 읽지 못했어요. 다시 촬영해 주세요.",
  rateLimited: "요청이 많아 잠시 기다린 뒤 다시 시도해 주세요.",
  gatewayTimeout: "인식 응답이 늦어지고 있어요. 다시 시도해 주세요.",
  serverFailure: "인식 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
  networkFailure: "네트워크 연결을 확인하고 다시 시도해 주세요.",
} as const;

export const MOCK_MESSAGES = {
  cancelled: "인식 요청이 취소되었습니다.",
  timeout: "인식 시간이 초과되었습니다. 다시 시도해 주세요.",
  transientFailure:
    "일시적으로 연결할 수 없습니다. 같은 사진으로 다시 시도해 주세요.",
} as const;
