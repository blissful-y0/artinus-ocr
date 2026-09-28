# 카메라 · OCR 기술 조사

후속 결정: 사용자 논의를 거쳐 Document AI Enterprise Document OCR의 품질 분석과 TypeScript GCP Cloud Run function을 선택했다. 자체 Python/OpenCV 분석 대신 서비스 품질 결과를 활용하며 샘플 검증을 앞두고 있다. 아래 온디바이스 추천은 초기 조사 당시의 제안이며, 현재 결정은 [구현 스펙](SPEC.md)을 따른다.

조사일: 2026-09-28. 기술 선택을 위한 조사이며 채택 결정이 아니다. 공식 문서, npm 배포 메타데이터와 배포된 네이티브 소스를 확인했다. 앱 빌드·실행·성능 측정은 하지 않았다.

## 추천 방향

Expo development build + expo-camera + 온디바이스 ML Kit Text Recognition v2를 우선 검증한다. Expo Go에 포함되지 않은 OCR 네이티브 모듈을 사용하므로 development build가 필요하다. Expo 사용 여부와 카메라 선택은 별개이며 Expo에서 VisionCamera도 사용할 수 있다.

정지 이미지 촬영 후 한 번 인식하는 과제이므로 실시간 frame processor, worklet 기반 연속 OCR은 초기 범위에 넣지 않는다. 초점·해상도·장치 제어가 실제로 필요해지면 VisionCamera V5를 비교 검증한다. 카메라 라이브러리만으로 특정 기기의 성능을 보장할 수는 없다.

OCR wrapper는 @react-native-ml-kit/text-recognition을 우선 기술 검증 대상으로 삼되 무조건 채택하지 않는다. 최신 RN/Android 빌드 호환성, 이미지 방향, 스레드와 자원 해제를 먼저 확인한다. 통합 문제가 크면 작은 로컬 Expo Module로 ML Kit 호출만 연결하는 대안을 검토한다. 엔진 자체 구현은 하지 않는다.

## 사용량과 배포 현황

npm registry latest 태그 및 npm 다운로드 API를 직접 조회했다. 다운로드 기간은 2026-09-20~2026-09-26이다. 다운로드 수는 CI·재설치 등을 포함하며 실제 앱 수나 품질 순위가 아니다.

| 패키지 | latest | 해당 버전 배포일 UTC | 주간 다운로드 |
| --- | --- | --- | ---: |
| expo-camera | 57.0.5 | 2026-09-11 | 2,463,138 |
| react-native-vision-camera | 5.2.3 | 2026-08-20 | 634,244 |
| @react-native-ml-kit/text-recognition | 2.0.0 | 2025-09-01 | 55,936 |
| @infinitered/react-native-mlkit-text-recognition | 5.0.1 | 2025-11-25 | 5,635 |
| rn-mlkit-ocr | 0.3.1 | 2026-01-22 | 921 |

배포일은 저장소의 마지막 유지보수 날짜와 다르다. Expo 패키지 버전을 단독 지정하지 않고 선택한 SDK에 맞춰 설치해야 한다. 검색에 나타나는 문서 버전과 npm latest가 다를 수 있으므로 프로젝트 생성 시 SDK/RN/패키지 조합을 다시 고정한다.

조회 URL: https://registry.npmjs.org/{package}, https://api.npmjs.org/downloads/point/2026-09-20:2026-09-26/{package}

## 생태계 변화

- RN 0.82부터 New Architecture만 사용한다. 기존 bridge 모듈도 interop으로 동작할 수 있지만, 오래된 peer dependency 범위만으로 현재 버전 호환을 단정하지 않는다.
- VisionCamera 공식 저장소는 V5 출시와 V4의 적극적인 유지보수 종료를 명시한다. V4의 takePhoto 예제와 V5의 photo output API를 혼용하지 않는다. V5.2.3은 Nitro Modules와 Nitro Image를 peer dependency로 요구한다.
- Expo development build는 커스텀 네이티브 라이브러리를 포함할 수 있다. Expo Go의 제한을 Expo 전체의 제한으로 해석하지 않는다.
- React Native ExecuTorch도 OCR API를 제공한다. 모델 다운로드·초기화·자원 관리를 포함하므로 이 과제에서는 ML Kit보다 먼저 도입할 이유가 약하다는 판단이다.

## 카메라 후보

| 후보 | 장점 | 과제에서의 판단 |
| --- | --- | --- |
| expo-camera | 프리뷰·권한·정지 이미지 촬영과 Expo 설정 연결 | 첫 번째 후보. 실제 촬영 지연과 이미지 방향 검증 필요 |
| VisionCamera V5 | 장치·해상도·FPS 제어, frame processor 등 폭넓은 기능 | 세밀한 제어가 필요할 때 후보. V5 API 및 추가 네이티브 의존성 검증 필요 |

Expo Camera는 onCameraReady 이후 촬영해야 하며 paused preview에서 촬영하는 동작은 플랫폼별 차이가 있다. 촬영 완료 이후 프리뷰를 정리하고 OCR로 넘기는 상태 전환을 명시한다.

## 엔진과 wrapper를 구분해야 하는 이유

ML Kit는 iOS/Android에서 사용할 수 있고 한국어를 포함한 다섯 문자 체계용 모델을 제공한다. 그러나 앱이 실제로 인식하는 범위는 wrapper가 포함한 모델과 호출 옵션에 따라 달라진다. 한국어·영어 혼합 문서 결과는 동일 샘플로 검증해야 한다.

Android bundled 모델은 즉시 사용할 수 있는 대신 앱 크기가 늘어난다. unbundled 모델은 최초 다운로드가 필요할 수 있다. 과제에서는 설치 직후 오프라인 실행과 재현성을 위해 bundled 방식을 우선 제안한다.

Apple Vision + Android ML Kit 조합도 가능하나 두 엔진의 결과·언어·오류 차이를 관리해야 한다. 양쪽 ML Kit를 쓰더라도 결과가 글자 단위로 동일하다는 보장은 없다. 기능 패리티와 인식 결과의 동일성은 구분한다.

Tesseract는 별도의 모델·네이티브 통합 검토가 필요하고, Cloud Vision은 인증·네트워크·이미지 업로드 처리가 추가된다. 현재 요구사항에는 온디바이스 ML Kit를 우선하는 것이 합리적이라는 판단이다. 엔진 간 정확도 우열을 측정한 것은 아니다.

## npm 배포 소스에서 확인한 내용

### @react-native-ml-kit/text-recognition 2.0.0

- iOS/Android에 Latin, Chinese, Devanagari, Japanese, Korean 모델 의존성을 포함한다.
- script 인자를 통해 recognizer를 선택한다. 기본값은 Latin이다.
- iOS podspec은 GoogleMLKit 8.0.0, iOS 15.5를 명시한다.
- 기존 React Native bridge 모듈이다. Android build.gradle에서 namespace 선언을 확인하지 못했다. 최신 Android Gradle Plugin 조합에서의 빌드 여부를 기술 검증 항목으로 둔다.
- Android recognize마다 recognizer를 생성하지만 해당 메서드에 close 호출이 보이지 않는다. 반복 실행 시 자원 관리 검토가 필요하며, 실제 누수를 재현한 것은 아니다.
- ML Kit의 비동기 API를 사용한다. 다만 파일 읽기·디코딩·결과 변환까지 모두 메인 스레드 밖이라고 검증한 것은 아니다.

### @infinitered/react-native-mlkit-text-recognition 5.0.1

- Expo Modules 기반이다.
- 배포된 iOS와 Android 구현은 기본 Latin recognizer를 사용하며 recognizeText에 script 선택 인자가 없다.
- ML Kit 엔진이 한국어를 지원한다는 사실만으로 이 wrapper가 한국어를 제공한다고 볼 수 없다. 한국어까지 제공하려면 변경이 필요하므로 현재 우선 후보에서 제외한다.
- 저장소의 호환성 표는 Expo SDK 54까지 기재돼 있다. 최신 SDK 지원 여부는 빌드 확인이 필요하다.

### rn-mlkit-ocr 0.3.1

- 모델 선택과 Android bundled/unbundled 설정을 제공한다. 사용량은 비교한 두 wrapper보다 적다.
- Android 로컬 파일 경로는 BitmapFactory.decodeFile 후 InputImage.fromBitmap(bitmap, 0)을 사용한다. 이 경로에서 EXIF 회전 반영을 확인하지 못했다. EXIF 방향을 가진 카메라 이미지에서 회전 문제가 생길 가능성이 있으므로 후보 채택 전에 검증해야 한다.
- 위 내용은 소스에 근거한 우려이며 기기에서 재현한 버그라고 주장하지 않는다.

소스는 각 npm registry의 dist.tarball로 제공되는 해당 버전을 읽었다. 저장소 main과 배포 버전은 다를 수 있다.

## 스펙에 반영할 제안

1. 카메라 프리뷰 → 정지 이미지 파일 → native OCR → 텍스트·이미지 확인 구조를 유지한다.
2. JS에는 이미지 base64/픽셀 대신 파일 URI와 결과 텍스트를 전달한다.
3. 중복 촬영 방지, 작업 식별자, 늦은 결과 무시, 임시 파일 삭제 책임을 정의한다. Promise timeout은 native 작업 취소와 다르다.
4. OCR 연산뿐 아니라 이미지 디코딩·리사이즈·결과 변환의 실행 스레드도 확인한다.
5. 저조도는 조명/토치 및 재촬영 안내, 블러는 초점·촬영 가이드, 회전은 EXIF 방향 처리부터 검증한다. 원근 보정과 별도 블러 판별기는 샘플 결과를 본 뒤 결정한다.
6. 정상·저조도·블러·회전·빈 이미지의 고정 샘플과 기대 텍스트를 준비한다. 정확도와 처리 시간은 측정한 결과만 기록한다.
7. Android 에뮬레이터 virtual scene에 문서 이미지를 넣어 프리뷰→촬영→OCR 연결을 검증한다. 별도 이미지 직접 입력 테스트와 구분한다.
8. iPhone 17 Pro에서는 반복 촬영, 앱 전환, 권한 변경, 발열·메모리와 UI 반응을 확인한다. Android 실기기 성능은 미검증으로 남는다.

## 확정 전에 할 기술 검증

- 선택한 RN/Expo 버전에서 iOS·Android 빌드
- iPhone 실제 촬영 이미지 OCR
- Android virtual scene 촬영 OCR
- 동일 샘플의 한국어·영어·회전 이미지 결과
- 비행기 모드 최초 OCR
- 연속 촬영 후 임시 파일과 recognizer 자원 관리
- UI 반응 및 메인 스레드 프로파일링

## 출처

- React Native New Architecture: https://reactnative.dev/blog/2025/10/08/react-native-0.82
- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo Camera: https://docs.expo.dev/versions/latest/sdk/camera/
- VisionCamera: https://github.com/margelo/react-native-vision-camera
- VisionCamera photo output: https://github.com/mrousavy/react-native-vision-camera/blob/main/docs/content/docs/photo-output.mdx
- ML Kit Android: https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- ML Kit iOS: https://developers.google.com/ml-kit/vision/text-recognition/v2/ios
- ML Kit 언어: https://developers.google.com/ml-kit/vision/text-recognition/v2/languages
- ML Kit wrapper: https://github.com/a7medev/react-native-ml-kit
- Infinite Red wrapper: https://github.com/infinitered/react-native-mlkit
- rn-mlkit-ocr: https://github.com/ahmeterenodaci/rn-mlkit-ocr
- Apple Vision: https://developer.apple.com/documentation/vision/recognizing-text-in-images
- ExecuTorch OCR: https://docs.swmansion.com/react-native-executorch/docs/api-reference/interfaces/OCRType
- Tesseract: https://github.com/tesseract-ocr/tesseract
- Cloud Vision OCR: https://cloud.google.com/vision/docs/ocr
- Android emulator camera: https://developer.android.com/studio/run/emulator-use-camera

## 후속 조사: 관리형 품질 분석

Cloud Vision OCR은 문서 저조도·블러 전용 결과를 제공하지 않는다. blurredLikelihood와 underExposedLikelihood는 얼굴 검출 결과다. Document AI Enterprise Document OCR은 enableImageQualityScores 옵션으로 dark, blurry 등 결함 정보를 제공한다. 추가 지연·오탐이 있어 실제 사진으로 검증한다. 별도 기울기 결함 항목은 없다.

출처: https://docs.cloud.google.com/document-ai/docs/enterprise-document-ocr#image-quality-analysis
