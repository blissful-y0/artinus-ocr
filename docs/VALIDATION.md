# 검증 기록

2026-09-28. 실제 OCR 서비스 연결 전 모의 응답 단계의 기록이다.

## 자동 검사

- `cd apps/mobile && npm run typecheck`: 통과.
- `npm run check`: Expo 호환 의존성 검사 통과.
- `npm run format:check`: 통과.
- `npx expo export --platform all`: iOS·Android Hermes 번들 생성 통과.
- `npx expo-doctor`: 21개 검사 통과(기반 구현 에이전트 실행).
- 모의 제공자: strict 컴파일 및 일회성 가상 타이머 검사로 7종 시나리오, 취소, 재시도, 늦은 응답을 확인했다. 별도 단위 테스트 파일은 추가하지 않았다.

## E2E 실행 방법

Maestro CLI와 실행 중인 에뮬레이터/시뮬레이터가 필요하다. development build를 설치하고 Metro에 연결한 뒤 실행한다. Expo 개발 메뉴가 떠 있으면 닫고 앱의 카메라 화면으로 돌아간다.

```sh
cd apps/mobile
EXPO_PUBLIC_ENABLE_FIXTURE=true npm start
# 다른 터미널에서 저장소 루트로 이동한 뒤
maestro --device <device-id> test .maestro/core.yaml
maestro --device <device-id> test .maestro/recovery.yaml
maestro --device <device-id> test .maestro/stale-response.yaml
```

- `core`: 샘플 사진 → 결과 → 확대 → 빈 결과 → 품질 경고.
- `recovery`: 일시적 실패 → 같은 사진 재시도 → 성공, 타임아웃 → 재촬영.
- `stale-response`: 8초 뒤 응답하며 취소를 무시하는 이전 요청 도중 재촬영 → 새 빈 결과가 이전 성공 응답으로 교체되지 않는지 확인.

샘플 E2E는 카메라 권한을 거부한 상태에서 실행해 UI·비동기 흐름을 분리 검증한다. Android의 실제 카메라 경로는 별도 `android-camera.yaml`에 작성했으나 아직 실행 검증하지 못했다.

샘플 사진은 카메라 하드웨어를 사용하지 않는다. 이 결과는 실제 촬영이나 OCR 인식 정확도의 증거가 아니다.

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

실제 OCR 연결 후 정상/저조도/블러/기울어짐/반사/작은 글자/문서 외 텍스트 샘플과 비행기 모드·연결 끊김을 추가한다. 품질 경고 정확도와 전체 업로드·처리 시간은 그때 측정한다.

## 빌드 환경과 결과

- macOS, Node.js 22.22.1, JDK 17.0.13, Xcode 27.0.
- Android `./gradlew assembleDebug`: 성공. compile/target SDK 36, API 34 에뮬레이터로 실행 검증 중.
- iOS Xcode Debug Simulator 빌드: 성공. iPhone 17 Pro / iOS 26.2 시뮬레이터 사용.
- 기존 API 35 16KB AVD는 설치 후 adb shell이 응답하지 않아 실행 검증에 사용하지 못했다. 별도 `artinus_api34` AVD를 만들어 재시도했다. 기존 AVD 데이터는 수정하지 않았다.
- 최초 iOS E2E는 개발 서버 열기 확인 및 Expo 개발 메뉴에 가려 실패했다. 앱 런타임 오류와 구분하며, 초기 안내를 닫은 뒤 재실행했다.

### Android 실행 제한

API 34 새 AVD에서도 성공·사진 확대/닫기·빈 결과·품질 경고 assertion은 통과했으나, 마지막 재촬영 중 ADB shell 응답까지 멈춰 전체 flow 종료를 확인하지 못했다. 카메라 권한 거부와 카메라 에뮬레이션 비활성화로 분리한 재시도에서도 ADB 무응답이 재발했다. 따라서 앱 카메라 코드가 원인이라고 단정하지 않고, Android E2E 전체와 촬영 검증을 미완료로 기록한다. 네이티브 APK 빌드는 성공했다.

## iOS E2E 최종 결과

2026-09-28 iPhone 17 Pro / iOS 26.2 시뮬레이터, Maestro 2.10.0. 세 flow 모두 통과(총 1분 24초).

| 흐름 | 결과 |
| --- | --- |
| core | 성공 결과·사진 1배/2배 확대·닫기·빈 결과·품질 경고 통과 |
| recovery | 첫 요청 실패·같은 사진 재시도 성공·10초 타임아웃·재촬영 통과 |
| stale-response | 처리 중 재촬영·새 빈 결과·이전 늦은 응답 무시 통과 |

실행 산출물: `artifacts/maestro-ios-verified/2026-09-28_174358/` (Git 제외). 사진 1배/2배 스크린샷으로 이미지와 닫기 버튼 위치도 직접 확인했다. 검증 중 모달 안전 영역, 이미지 초기 치수, 확대 영역의 크기 제한, Expo 도구 버튼과 닫기 버튼 겹침을 수정했다. 개발 시나리오 선택은 가로 스크롤 대신 줄바꿈 배치로 바꿔 모든 시나리오를 바로 선택할 수 있게 했다.

이 결과는 샘플 이미지와 모의 OCR의 UI 흐름 증거다. iPhone 17 Pro 실기기 촬영·토치·프리뷰 성능, Android 전체 E2E, 실제 OCR·품질 분석은 여전히 미검증이다.

## 기능별 커밋 검증

기능별 이력을 정리한 뒤 기반(`c63ceab`), 카메라(`f47c92a`), 결과 화면(`868ac6a`), OCR 연결(`caf348a`)의 Git 스냅샷을 각각 임시 디렉터리에 추출해 `tsc --noEmit` 통과를 확인했다. 기존에 설치된 동일한 의존성을 연결해 검사했으며, 커밋마다 새로 설치하거나 네이티브 빌드·E2E를 반복한 것은 아니다. 최종 포맷 검사와 Expo 의존성 검사도 통과했다.

## 실제 Google OCR 연결 — 2026-09-29

- Cloud Run `artinus-ocr-api-00002-np4` 배포 및 실제 Document AI 호출 성공.
- 공개 URL의 `/health` 200, 인증 없는 `/ocr` 401 확인. 실제 OCR POST는 리다이렉트 없이 200 응답.
- 저장소의 합성 샘플을 JPEG로 변환해 전송했다. `ARTINUS OCR`, `Camera flow test`, `September 2026`, `SAMPLE IMAGE`, `Mock results are fixtures.` 문장을 실제 엔진이 반환했다. 이미지에 적힌 Mock 문장은 입력 자체의 내용이며 서버 응답을 모의 생성한 것이 아니다.
- 단일 HTTP 측정 1,804ms. 일반 지연 시간·콜드 스타트 성능을 대표하지 않는다.
- 같은 응답의 `GLARE`, `CROPPED` 품질 경고 전달 확인. 합성 샘플에도 경고가 나왔으므로 이를 실제 결함 검출 정확도의 증거로 보지 않는다. 저조도·블러·기울어짐은 촬영 샘플로 추가 검증해야 한다.
- 서버 build 및 HTTP/SDK 경계 테스트 8/8 통과. 초기 배포에서 `retry: null`과 `maxRetries: 0` 조합이 실제 SDK 내부 TypeError를 일으켰다. `maxRetries`를 제거하고 실제 `google-gax CallSettings.merge`를 사용하는 회귀 테스트를 추가했다.
- 모바일 TypeScript·포맷 검사 통과, remote 모드 iOS·Android Hermes 번들 생성 통과. 이번 변경으로 네이티브 빌드를 다시 실행하지 않았으며 기존 Debug 빌드에서 새 JS를 실행했다.
- 로컬 HTTP 모의 서버로 인증 오류 → 코드 변경 → 성공 → 확대 → 재촬영 E2E를 먼저 통과했다. 이는 Google 연결 검증과 별개다.

원격 E2E는 `EXPO_PUBLIC_OCR_MODE=remote`, `EXPO_PUBLIC_ENABLE_FIXTURE=true`, 배포 URL로 Metro를 시작하고 `MAESTRO_OCR_ACCESS_CODE`를 환경변수로 전달해 `maestro --device <id> test .maestro/remote.yaml`을 실행한다. 코드 값은 저장소·명령 인자에 넣지 않는다. Maestro 산출물에도 코드가 포함될 수 있으므로 Git에서 제외된 로컬 디렉터리에 보관하고 공유 전에 제거한다.

실제 카메라 하드웨어는 이번 원격 E2E에 사용하지 않는다. iPhone 17 Pro 실기기 프리뷰·촬영·메모리·발열, Android 전체 E2E와 실제 OCR 호출, 나쁜 촬영 입력의 경고 정확도는 미검증이다.

### 실제 서버 iOS E2E 결과

iPhone 17 Pro / iOS 26.2 시뮬레이터에서 `.maestro/remote.yaml` 전체 통과. 잘못된 코드의 인증 오류·재시도 버튼 숨김 → 코드 변경 → 실제 Google OCR 텍스트 확인 → 사진 확대·닫기 → 재촬영을 검증했다. 품질 경고 두 개로 텍스트가 스크롤 아래에 놓이는 경우가 있어, 초기 테스트의 단순 visible 대기를 scrollUntilVisible로 수정했다.

산출물: `artifacts/live-ocr/smoke.json`, `artifacts/live-ocr/maestro-final/.maestro/tests/2026-09-29_200617/` (Git 제외). 성공 화면에서 인식문과 경고를 직접 확인했다.
