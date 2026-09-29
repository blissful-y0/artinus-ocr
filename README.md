# ARTINUS OCR

2026-09 ARTINUS Frontend Engineer 과제용 React Native 앱입니다. 카메라로 촬영한 사진을 처리하고, 사진과 인식 결과를 확인하는 흐름을 구현합니다.

촬영한 JPEG를 TypeScript Cloud Run 함수로 보내고 Google Document AI에서 텍스트와 이미지 품질 정보를 받아 표시합니다. 원격 연결과 별개로, 네트워크 없이 오류·취소 흐름을 검증할 모의 OCR 모드도 제공합니다. 배포와 실제 호출의 확인 결과는 [GCP 연결 상태](docs/GCP_SETUP.md)와 [검증 기록](docs/VALIDATION.md)에 구분해 기록합니다.

## 실행

Node.js와 플랫폼별 개발 도구(Android SDK·JDK / macOS·Xcode·CocoaPods)가 필요합니다.

```sh
cd apps/mobile
npm ci
cp .env.example .env
npm run typecheck
npm run check
npm run android
# macOS에서 iOS 실행
npm run ios
```

Expo development build를 사용합니다. 네이티브 프로젝트는 Expo 설정으로 생성합니다. 기기 실행은 `npx expo run:ios --device`를 사용합니다. 카메라가 없는 시뮬레이터에서 화면 흐름을 확인하려면 `.env`의 `EXPO_PUBLIC_ENABLE_FIXTURE=true`를 설정하고 Metro를 다시 시작합니다. 샘플 버튼은 개발 빌드에서만 나타나며, remote 모드에서는 실제 서버로 사진을 보냅니다.

원격 연결은 `EXPO_PUBLIC_OCR_MODE=remote`와 `EXPO_PUBLIC_OCR_API_URL`을 설정하고, 첫 화면에 별도로 전달받은 평가용 접근 코드를 입력합니다. 코드는 앱 실행 중 메모리에만 보관됩니다. Google 계정 비밀번호가 아닙니다. 모의 흐름만 검증하려면 `EXPO_PUBLIC_OCR_MODE=mock`으로 바꿉니다.

`EXPO_PUBLIC_*`는 앱에 공개되는 설정입니다. OCR API 키, 서비스 계정 키, 평가용 코드를 넣지 않습니다. 서버 재현·배포 방법은 [서버 README](apps/ocr-api/README.md)를 참고합니다.

## 선택과 구조

- **React Native + TypeScript**: iOS와 Android에서 화면·상태·오류 계약을 공유합니다.
- **Expo + Expo Camera**: 네이티브 카메라 프리뷰와 정지 이미지 촬영을 사용합니다. 실시간 프레임 OCR은 수행하지 않습니다.
- **Expo Image Manipulator / FileSystem**: 네이티브에서 긴 변을 2400px로 제한하고 JPEG 품질 0.85로 변환하며 임시 파일을 관리합니다. 전송용 base64는 비동기로 읽고 React 상태에 보관하지 않습니다.
- **OCR Provider 분리**: 모의 제공자와 실제 HTTP 제공자가 공통 결과 타입을 사용합니다. TypeScript 중계 함수는 Google Document AI의 OCR과 이미지 품질 분석을 함께 요청합니다.
- **Cloud Run + 서비스 계정**: 서버에 연결한 계정으로 Google API를 호출합니다. 앱에는 Google 자격증명이 없으며, 중계 API는 평가용 코드 인증과 호출 제한을 적용합니다.
- **명시적 상태 전환**: 촬영·처리·결과·오류를 구분하고, 재촬영으로 취소한 요청의 늦은 응답은 무시합니다. 재시도 가능한 오류는 같은 사진으로 다시 처리합니다.

클라우드 OCR은 네트워크 지연·실패·비용이 있고 사진을 Google Cloud로 전송합니다. 코드와 함수는 사진·인식문을 별도 저장하거나 로그에 남기지 않습니다. 품질 경고는 결함 confidence가 0.5 이상일 때 표시하며 오탐·누락이 있을 수 있습니다. 별도 기울기 감지·원근 보정은 없고, 원본 비교와 재촬영으로 대응합니다. 앱 내 기록 저장과 텍스트 수정·복사는 범위에서 제외합니다.

공유 평가코드와 인스턴스별 호출 제한은 과제 평가용 구성입니다. 사용자별 인증이나 분산된 영구 한도가 아니며, 최대 인스턴스 설정도 엄격한 과금 상한을 보장하지 않습니다.

## 개발용 시나리오

mock 모드에서 성공, 텍스트 없음, 품질 경고, 실패 후 같은 사진으로 재시도, 느린 응답, 타임아웃, 취소 후 늦은 응답을 선택할 수 있습니다. 모의 시나리오의 텍스트·경고는 고정 데이터이며 실제 분석 결과가 아닙니다.

## 검증

테스트 코드는 최소한으로 유지하고, 핵심 사용자 흐름은 Maestro E2E로 검증합니다. 빌드·자동화 결과는 검증 완료 후 기록합니다.

| 구분 | 상태 |
| --- | --- |
| TypeScript·Expo 의존성 검사·포맷 | 통과 |
| iOS·Android JS/Hermes 번들 생성 | 통과 |
| Android Debug 빌드 | 성공 |
| Android 에뮬레이터 E2E | 일부 단계 확인, ADB 무응답으로 전체 완료 못 함 |
| iOS 시뮬레이터 Debug 빌드 | 성공 |
| iOS 시뮬레이터 E2E | mock 3개 흐름 + 실제 서버 remote 흐름 통과 |
| iPhone 17 Pro 실기기 | 미검증, 사용자 기기에서 진행 예정 |
| Android 실기기 프리뷰·메모리·발열 | 미검증, 에뮬레이터로 대체 검증할 수 없음 |
| 실제 Google OCR HTTP 호출 | 샘플 텍스트 인식 성공, 1회 측정 1,804ms; 품질 경고 전달 확인 |
| 서버 HTTP·SDK 경계 테스트 | 8개 통과 |

## AI 활용 기록

Codex로 요구사항 정리, 공식 문서·라이브러리 조사, 구현 계획과 앱 코드를 작성합니다. 사용자가 지정한 배정 기준은 복잡한 기반·통합 작업에 GPT-6 Astra, 독립 구현에 GPT-6 Sol xhigh, 단순 정리에 GPT-6 Luna max입니다. 현재 기반·카메라, 결과 화면, 모의 OCR을 파일 범위별로 나눠 병렬 구현하고 메인 에이전트가 통합·검증합니다.

- AI 생성: 초기 앱 기반, 화면, 상태 처리, 모의·원격 OCR 제공자, TypeScript 서버, 배포 스크립트, 문서.
- 검증·수정: 모의 제공자의 취소·타이머 정리와 재시도 동작을 에이전트가 확인했습니다. 양쪽 네이티브 빌드와 iOS 시뮬레이터 E2E 3개 흐름을 통과했습니다. iOS 확대 이미지·안전 영역·개발 버튼 겹침 문제는 E2E와 스크린샷을 보고 수정했습니다. Android E2E는 에뮬레이터 무응답으로 완료하지 못했습니다. 사람의 직접 수정·실기기 검증으로 기록하지 않습니다.
- 실제 연동 검증·수정: 배포 후 실제 요청에서 SDK의 `retry: null`과 `maxRetries: 0` 충돌을 발견했습니다. `maxRetries`를 제거하고 실제 SDK 옵션 병합 회귀 테스트를 추가해 수정했습니다. Google OCR 샘플 호출 성공을 확인했으며, 합성 이미지의 품질 경고는 정확도 검증과 구분합니다.
- 별도 판단: 실제 서비스 인증을 기다리며 고정 응답으로 UI를 먼저 구현하되, 이를 실제 OCR이나 자동 품질 감지로 표시하지 않기로 했습니다. 테스트는 사용자 요청에 따라 핵심 E2E 위주로 제한합니다.

## 문서

- [구현 스펙](docs/SPEC.md)
- [기술 조사](docs/RESEARCH.md)
- [구현 계획·에이전트 분담](docs/IMPLEMENTATION_PLAN.md)

- [검증 기록과 E2E 실행법](docs/VALIDATION.md)
