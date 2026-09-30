# 검증 기록

시간 순으로 쌓는 기록입니다. 각 절의 날짜는 그 시점의 검증 범위를 뜻하고 뒤 절이 앞 절의 미검증 항목을 덮어씁니다. 최신 상태는 [검증 요약](#검증-요약)에서 봅니다.

## 검증 요약

작성 기준일은 2026-09-30입니다.

| 항목 | 상태 |
| --- | --- |
| 모바일 단위 테스트 (useScan 8, remoteOcrProvider 12) | 통과 |
| 서버 HTTP·SDK 경계 테스트 8건 | 통과 |
| TypeScript·포맷·Expo 의존성 검사 | 통과 |
| iOS 시뮬레이터 E2E (mock 3흐름 + remote 1흐름) | 통과 |
| Android 네이티브 빌드·에뮬레이터 E2E 5흐름 (실제 카메라·실제 OCR 포함) | 통과 |
| iPhone 17 Pro 실기기 (Expo Go) | 프리뷰·촬영·실제 OCR·기울어진 텍스트 인식 확인 |
| Android 실기기 | 미검증. 검증 가능한 기기 없음 |

## 자동 검사 — 2026-09-28

- `cd apps/mobile && npm run typecheck`: 통과.
- `npm run check`: Expo 호환 의존성 검사 통과.
- `npm run format:check`: 통과.
- `npx expo export --platform all`: iOS·Android Hermes 번들 생성 통과.
- `npx expo-doctor`: 21개 검사 통과(기반 구현 에이전트 실행).
- 모의 제공자: strict 컴파일 및 일회성 가상 타이머 검사로 7종 시나리오, 취소, 재시도, 늦은 응답을 확인했습니다. 별도 단위 테스트 파일은 추가하지 않았습니다.

## 테스트 실행 방법

### 단위 테스트

```sh
cd apps/mobile && npm test        # useScan 8건, remoteOcrProvider 12건
cd apps/ocr-api && npm test       # HTTP·SDK 경계 8건
```

`useScan` 테스트는 E2E로 만들기 비싼 비동기 경계를 고정합니다. 취소한 요청의 늦은 응답 무시, 제공자가 파일을 읽는 동안의 삭제 지연, 같은 사진 재시도, 재시도 불가 오류, 가짜 타이머로 재현한 타임아웃과 abort 신호입니다. `remoteOcrProvider` 테스트는 응답 계약을 고정합니다. 요청 ID 불일치·알 수 없는 경고 코드 거부, 401의 재시도 불가 처리, 서버가 재시도 가능하다고 해도 `INVALID_IMAGE`는 재시도하지 않는 규칙, https 아닌 주소·형식이 틀린 코드·5MB 초과 파일을 전송 전에 막는 동작입니다.

### E2E

Maestro CLI와 실행 중인 에뮬레이터/시뮬레이터가 필요합니다. development build를 설치하고 Metro에 연결한 뒤 실행합니다. Expo 개발 메뉴가 떠 있으면 닫고 앱의 카메라 화면으로 돌아갑니다.

```sh
cd apps/mobile
EXPO_PUBLIC_ENABLE_FIXTURE=true npm start
# 다른 터미널에서 저장소 루트로 이동한 뒤
maestro --device <device-id> test .maestro/core.yaml
maestro --device <device-id> test .maestro/recovery.yaml
maestro --device <device-id> test .maestro/stale-response.yaml
maestro --device <device-id> test .maestro/android-camera.yaml
```

- `core`: 샘플 사진 → 결과 → 확대 → 빈 결과 → 품질 경고.
- `recovery`: 일시적 실패 → 같은 사진 재시도 → 성공, 타임아웃 → 재촬영.
- `stale-response`: 8초 뒤 응답하며 취소를 무시하는 이전 요청 도중 재촬영 → 새 빈 결과가 이전 성공 응답으로 교체되지 않는지 확인.
- `android-camera`: 권한 거부 화면 → 허용 → 실제 카메라로 촬영 → 결과 → 확대·닫기·재촬영. Android 전용이며 카메라 에뮬레이션이 켜진 AVD가 필요합니다.

앞의 세 흐름은 카메라 권한을 거부한 상태로 샘플 이미지를 써서 UI·비동기 흐름만 분리해 검증합니다. 카메라 하드웨어 경로의 증거는 `android-camera`와 실기기 수동 검증이 담당합니다.

## 기기별 수동 검증 기준

| 항목 | iPhone 17 Pro | Android 에뮬레이터 |
| --- | --- | --- |
| 권한 처음 허용 / 거부 / 설정에서 복구 | 미검증 | 미검증 |
| 프리뷰 → 실제 촬영 → 결과 사진 확인 | 미검증 | 미검증 |
| 촬영 버튼 연타, 처리 중 재촬영 | 미검증 | 미검증 |
| 앱 전환 후 카메라 복귀·토치 꺼짐 | 미검증 | 미검증 |
| 결과 사진 확대·이동·닫기 | 미검증 | 미검증 |
| 임시 사진 정리 | 코드 검토만 완료 | 코드 검토만 완료 |
| 프리뷰 반응·메모리·발열 | 미검증 | 실기기 성능 판정 제외 |

실제 OCR 연결 후 정상/저조도/블러/기울어짐/반사/작은 글자/문서 외 텍스트 샘플과 비행기 모드·연결 끊김을 추가합니다. 품질 경고 정확도와 전체 업로드·처리 시간은 그때 측정합니다.

## 빌드 환경과 결과

- macOS, Node.js 22.22.1, JDK 17.0.13, Xcode 27.0.
- Android `./gradlew assembleDebug`: 성공. compile/target SDK 36, API 34 에뮬레이터로 실행 검증 중.
- iOS Xcode Debug Simulator 빌드: 성공. iPhone 17 Pro / iOS 26.2 시뮬레이터 사용.
- 기존 API 35 16KB AVD는 설치 후 adb shell이 응답하지 않아 실행 검증에 쓰지 못했습니다. 별도 `artinus_api34` AVD를 만들어 재시도했습니다. 기존 AVD 데이터는 수정하지 않았습니다.
- 최초 iOS E2E는 개발 서버 열기 확인 및 Expo 개발 메뉴에 가려 실패했습니다. 앱 런타임 오류와 구분하고 초기 안내를 닫은 뒤 재실행했습니다.

### Android 실행 제한

API 34 새 AVD에서도 성공·사진 확대/닫기·빈 결과·품질 경고 assertion은 통과했지만 마지막 재촬영 중 ADB shell 응답까지 멈춰 전체 flow 종료를 확인하지 못했습니다. 카메라 권한 거부와 카메라 에뮬레이션 비활성화로 분리한 재시도에서도 ADB 무응답이 재발했습니다. 그래서 앱 카메라 코드가 원인이라고 단정하지 않고 Android E2E 전체와 촬영 검증을 미완료로 기록합니다. 네이티브 APK 빌드는 성공했습니다.

## iOS E2E 최종 결과

2026-09-28 iPhone 17 Pro / iOS 26.2 시뮬레이터, Maestro 2.10.0. 세 flow 모두 통과했습니다(총 1분 24초).

| 흐름 | 결과 |
| --- | --- |
| core | 성공 결과·사진 1배/2배 확대·닫기·빈 결과·품질 경고 통과 |
| recovery | 첫 요청 실패·같은 사진 재시도 성공·10초 타임아웃·재촬영 통과 |
| stale-response | 처리 중 재촬영·새 빈 결과·이전 늦은 응답 무시 통과 |

실행 산출물: `artifacts/maestro-ios-verified/2026-09-28_174358/` (Git 제외). 사진 1배/2배 스크린샷으로 이미지와 닫기 버튼 위치도 직접 확인했습니다. 검증 중 모달 안전 영역, 이미지 초기 치수, 확대 영역의 크기 제한, Expo 도구 버튼과 닫기 버튼 겹침을 수정했습니다. 개발 시나리오 선택은 가로 스크롤 대신 줄바꿈 배치로 바꿔 모든 시나리오를 바로 고를 수 있게 했습니다.

이 결과는 샘플 이미지와 모의 OCR의 UI 흐름 증거입니다. iPhone 17 Pro 실기기 촬영·토치·프리뷰 성능, Android 전체 E2E, 실제 OCR·품질 분석은 여전히 미검증입니다.

## 기능별 커밋 검증

기능별 이력을 정리한 뒤 기반(`c63ceab`), 카메라(`f47c92a`), 결과 화면(`868ac6a`), OCR 연결(`caf348a`)의 Git 스냅샷을 각각 임시 디렉터리에 추출해 `tsc --noEmit` 통과를 확인했습니다. 기존에 설치된 동일한 의존성을 연결해 검사했고 커밋마다 새로 설치하거나 네이티브 빌드·E2E를 반복하지는 않았습니다. 최종 포맷 검사와 Expo 의존성 검사도 통과했습니다.

## 실제 Google OCR 연결 — 2026-09-29

- Cloud Run `artinus-ocr-api-00002-np4` 배포 및 실제 Document AI 호출 성공.
- 공개 URL의 `/health` 200, 인증 없는 `/ocr` 401 확인. 실제 OCR POST는 리다이렉트 없이 200 응답.
- 저장소의 합성 샘플을 JPEG로 변환해 전송했습니다. `ARTINUS OCR`, `Camera flow test`, `September 2026`, `SAMPLE IMAGE`, `Mock results are fixtures.` 문장을 실제 엔진이 반환했습니다. 이미지에 적힌 Mock 문장은 입력 자체의 내용이고 서버 응답을 모의로 꾸며낸 것이 아닙니다.
- 단일 HTTP 측정 1,804ms. 일반 지연 시간·콜드 스타트 성능을 대표하지 않습니다.
- 같은 응답의 `GLARE`, `CROPPED` 품질 경고 전달 확인. 합성 샘플에도 경고가 나왔으므로 이를 실제 결함 검출 정확도의 증거로 보지 않습니다. 저조도·블러·기울어짐은 촬영 샘플로 더 검증해야 합니다.
- 서버 build 및 HTTP/SDK 경계 테스트 8/8 통과. 초기 배포에서 `retry: null`과 `maxRetries: 0` 조합이 실제 SDK 내부 TypeError를 일으켰습니다. `maxRetries`를 제거하고 실제 `google-gax CallSettings.merge`를 쓰는 회귀 테스트를 추가했습니다.
- 모바일 TypeScript·포맷 검사 통과, remote 모드 iOS·Android Hermes 번들 생성 통과. 이번 변경으로 네이티브 빌드를 다시 실행하지 않았고 기존 Debug 빌드에서 새 JS를 실행했습니다.
- 로컬 HTTP 모의 서버로 인증 오류 → 코드 변경 → 성공 → 확대 → 재촬영 E2E를 먼저 통과했습니다. 이는 Google 연결 검증과 별개입니다.

원격 E2E는 `EXPO_PUBLIC_OCR_MODE=remote`, `EXPO_PUBLIC_ENABLE_FIXTURE=true`, 배포 URL로 Metro를 시작하고 `MAESTRO_OCR_ACCESS_CODE`를 환경변수로 전달해 `maestro --device <id> test .maestro/remote.yaml`을 실행합니다. 코드 값은 저장소·명령 인자에 넣지 않습니다. Maestro 산출물에도 코드가 들어갈 수 있으므로 Git에서 제외된 로컬 디렉터리에 보관하고 공유 전에 지웁니다.

실제 카메라 하드웨어는 이번 원격 E2E에 쓰지 않습니다. iPhone 17 Pro 실기기 프리뷰·촬영·메모리·발열, Android 전체 E2E와 실제 OCR 호출, 나쁜 촬영 입력의 경고 정확도는 미검증입니다.

### 실제 서버 iOS E2E 결과

iPhone 17 Pro / iOS 26.2 시뮬레이터에서 `.maestro/remote.yaml` 전체 통과. 잘못된 코드의 인증 오류·재시도 버튼 숨김 → 코드 변경 → 실제 Google OCR 텍스트 확인 → 사진 확대·닫기 → 재촬영을 검증했습니다. 품질 경고 두 개 때문에 텍스트가 스크롤 아래에 놓이는 경우가 있어 초기 테스트의 단순 visible 대기를 scrollUntilVisible로 고쳤습니다.

산출물: `artifacts/live-ocr/smoke.json`, `artifacts/live-ocr/maestro-final/.maestro/tests/2026-09-29_200617/` (Git 제외). 성공 화면에서 인식문과 경고를 직접 확인했습니다.

## Android 검증 완료 — 2026-09-30

이전 기록의 "ADB 무응답으로 Android E2E 미완료"를 해소했습니다. 제출 직전 점검에서 이 맥에 Xcode 27.0·JDK 17.0.13·Android SDK·gcloud가 남아 있지 않은 것을 확인하고 도구를 새로 설치해 처음부터 다시 빌드·검증했습니다.

### 검증 환경

- macOS 26.5(Darwin 25.5.0), Node.js 22.22.0.
- JDK 17.0.20.1 (Homebrew openjdk@17), Android SDK cmdline-tools, platform-tools 37.0.1, NDK 27.1.12297006, cmake 3.22.1.
- AVD `artinus_api36`: Android 16 (API 36), google_apis, arm64-v8a, Pixel 7, 후면 카메라 `virtualscene`.
- Maestro 2.x, Expo 57.0.25 / React Native 0.86.3.

### 결과

| 흐름 | 결과 |
| --- | --- |
| `./gradlew assembleDebug` | 성공. `app-debug.apk` 생성·설치 |
| `core` | 통과. 성공 결과·사진 1배/2배 확대·닫기·빈 결과·품질 경고 |
| `recovery` | 통과. 일시적 실패 → 같은 사진 재시도 성공 → 타임아웃 → 재촬영 |
| `stale-response` | 통과. 처리 중 재촬영, 이전 늦은 응답이 새 결과를 덮지 않음 |
| `android-camera` | 통과. 권한 거부 화면 → 허용 → **에뮬레이터 실제 카메라 촬영** → 결과 → 확대·닫기·재촬영 |
| `remote` (실제 Google Document AI) | 통과. 잘못된 코드 401·재시도 버튼 숨김 → 코드 변경 → 실제 인식문 표시 → 확대·닫기·재촬영 |

`android-camera`는 이번에 처음 실행했습니다. 앞선 기록에서는 작성만 하고 실행하지 못한 흐름입니다.

### 이번에 고친 것

- `android-camera.yaml`이 `camera-capture`가 보이자마자 탭해 실패했습니다. 버튼은 `onCameraReady` 전에도 렌더되지만 탭을 무시하므로 탭이 카메라 준비 구간에 떨어지면 아무 일도 일어나지 않습니다. 선택자에 `enabled: true`를 넣어 준비될 때까지 기다리도록 고쳤습니다. 앱 코드 결함이 아니라 테스트의 경합이었습니다.
- 빌드는 cmake가 임시 파일을 쓰지 못해 한 번 실패했습니다. 실행 환경의 샌드박스 제한이었고 앱·Gradle 설정 문제는 아니었습니다.

### 남은 Android 공백

에뮬레이터 검증은 Android 실기기의 프리뷰 반응·메모리·발열을 대신하지 못합니다. 검증 가능한 Android 실기기가 없어 이 항목은 미검증으로 남깁니다. `virtualscene` 카메라는 실제 렌즈·자동초점·저조도 특성과 다릅니다.

에뮬레이터가 실행 중 한 번 ADB 연결을 잃어 흐름이 끊겼고 재연결 후 같은 흐름이 통과했습니다. 앞선 기록의 ADB 무응답과 같은 계열로 보이지만 앱 코드가 원인이라는 근거는 없습니다.

### 결과 화면 순서 변경 이후

위 Android E2E 5흐름은 결과 화면 순서를 바꾸기 전에 통과한 기록입니다. 이후 인식 텍스트를 품질 경고보다 위로 올렸고 텍스트가 없을 때는 경고를 원인으로 묶어 한 카드에 넣었습니다. 개발용 모의 시나리오 패널은 기본으로 접어 두고 `mock-panel-toggle`로 펼치도록 바꿨으며 mock 흐름 세 개에 이 토글 단계를 추가했습니다.

변경 이후 TypeScript·포맷·단위 테스트 28건과 Android 에뮬레이터 실행 화면을 다시 확인했습니다. E2E 5흐름 전체는 다시 실행하지 않았습니다.

## iPhone 17 Pro 실기기 검증 — 2026-09-30

최종본을 Expo Go로 iPhone 17 Pro(iOS 27.2)에 올려 직접 촬영했습니다.

| 항목 | 결과 |
| --- | --- |
| 카메라 프리뷰 | 끊김 없이 동작 |
| 촬영 → 실제 Google OCR 응답 | 정상 |
| 기울여 찍은 글자(30~45도) | 정상 인식 |
| 전반 동작 | 문제 없음 |

기울어진 입력은 그동안 유일하게 증거가 없던 요구사항이었습니다. 이번 촬영으로 Document AI의 회전 보정이 실제 사진에서도 작동하는 것을 확인했습니다.

### 이 검증에 포함되지 않은 것

- **수치 측정.** 지연 시간, 메모리, 발열은 눈으로 본 것이지 재지 않았습니다.
- **네이티브 빌드의 기기 설치.** Expo Go로 띄웠습니다. 이 맥의 Xcode 26.6이 기기의 iOS 27.2를 지원하지 않아 development build를 기기에 설치하지 못했습니다(`devicectl`이 developer disk image를 마운트하지 못함). 따라서 `app.json`의 카메라 권한 안내 문구와 `blockedPermissions`는 시뮬레이터·에뮬레이터에서만 확인했고, 실기기에서 뜬 권한 팝업 문구는 Expo Go의 것입니다.
- **릴리스 번들 성능.** Expo Go는 개발 번들을 실행합니다.
- **저조도·블러 경고의 실기기 정확도.** 이번 촬영에서 따로 재현해 확인하지 않았습니다.

### 남은 공백

Android 실기기는 검증 가능한 기기가 없어 여전히 미검증입니다. 에뮬레이터 검증이 실기기의 프리뷰 반응·메모리·발열을 대신하지 못합니다.
