# 카메라 · OCR 기술 조사

후속 결정: 사용자와 논의한 끝에 Document AI Enterprise Document OCR의 품질 분석과 TypeScript GCP Cloud Run function을 선택했습니다. 자체 Python/OpenCV 분석 대신 서비스 품질 결과를 활용하며 샘플 검증을 앞두고 있습니다. 아래 온디바이스 추천은 초기 조사 당시의 제안입니다. 현재 결정은 [구현 스펙](SPEC.md)을 따릅니다.

조사일: 2026-09-28. 기술을 고르려고 한 조사이며 채택 결정은 아닙니다. 공식 문서, npm 배포 메타데이터, 배포된 네이티브 소스를 확인했습니다. 앱 빌드·실행·성능 측정은 하지 않았습니다.

## 추천 방향

Expo development build + expo-camera + 온디바이스 ML Kit Text Recognition v2를 먼저 검증합니다. Expo Go에 없는 OCR 네이티브 모듈을 쓰므로 development build가 필요합니다. Expo를 쓰는지와 카메라 선택은 별개이고 Expo에서도 VisionCamera를 쓸 수 있습니다.

정지 이미지를 찍고 한 번 인식하는 과제이므로 실시간 frame processor와 worklet 기반 연속 OCR은 초기 범위에 넣지 않습니다. 초점·해상도·장치 제어가 실제로 필요해지면 VisionCamera V5를 비교 검증합니다. 카메라 라이브러리만으로 특정 기기의 성능을 보장할 수는 없습니다.

OCR wrapper는 @react-native-ml-kit/text-recognition을 우선 기술 검증 대상으로 삼되 무조건 채택하지는 않습니다. 최신 RN/Android 빌드 호환성, 이미지 방향, 스레드와 자원 해제를 먼저 확인합니다. 통합 문제가 크면 작은 로컬 Expo Module로 ML Kit 호출만 연결하는 대안을 검토합니다. 엔진 자체 구현은 하지 않습니다.

## 사용량과 배포 현황

npm registry latest 태그와 npm 다운로드 API를 직접 조회했습니다. 다운로드 기간은 2026-09-20~2026-09-26입니다. 다운로드 수에는 CI와 재설치가 섞여 있어 실제 앱 수나 품질 순위가 아닙니다.

| 패키지 | latest | 해당 버전 배포일 UTC | 주간 다운로드 |
| --- | --- | --- | ---: |
| expo-camera | 57.0.5 | 2026-09-11 | 2,463,138 |
| react-native-vision-camera | 5.2.3 | 2026-08-20 | 634,244 |
| @react-native-ml-kit/text-recognition | 2.0.0 | 2025-09-01 | 55,936 |
| @infinitered/react-native-mlkit-text-recognition | 5.0.1 | 2025-11-25 | 5,635 |
| rn-mlkit-ocr | 0.3.1 | 2026-01-22 | 921 |

배포일은 저장소의 마지막 유지보수 날짜와 다릅니다. Expo 패키지는 버전을 단독으로 지정하지 말고 선택한 SDK에 맞춰 설치해야 합니다. 검색에 나타나는 문서 버전과 npm latest가 다를 수 있으므로 프로젝트를 만들 때 SDK/RN/패키지 조합을 다시 고정합니다.

조회 URL: https://registry.npmjs.org/{package}, https://api.npmjs.org/downloads/point/2026-09-20:2026-09-26/{package}

## 생태계 변화

- RN 0.82부터는 New Architecture만 씁니다. 기존 bridge 모듈도 interop으로 동작할 수 있지만 오래된 peer dependency 범위만으로 현재 버전 호환을 단정하지는 않습니다.
- VisionCamera 공식 저장소는 V5 출시와 V4의 적극적인 유지보수 종료를 명시합니다. V4의 takePhoto 예제와 V5의 photo output API는 섞어 쓰지 않습니다. V5.2.3은 Nitro Modules와 Nitro Image를 peer dependency로 요구합니다.
- Expo development build는 커스텀 네이티브 라이브러리를 포함할 수 있습니다. Expo Go의 제한을 Expo 전체의 제한으로 해석하지 않습니다.
- React Native ExecuTorch도 OCR API를 제공합니다. 모델 다운로드·초기화·자원 관리가 따라오므로 이 과제에서 ML Kit보다 먼저 도입할 이유는 약하다고 봅니다.

## 카메라 후보

| 후보 | 장점 | 과제에서의 판단 |
| --- | --- | --- |
| expo-camera | 프리뷰·권한·정지 이미지 촬영과 Expo 설정 연결 | 첫 번째 후보. 실제 촬영 지연과 이미지 방향 검증 필요 |
| VisionCamera V5 | 장치·해상도·FPS 제어, frame processor 등 폭넓은 기능 | 세밀한 제어가 필요할 때 후보. V5 API 및 추가 네이티브 의존성 검증 필요 |

Expo Camera는 onCameraReady 이후에 촬영해야 하고 paused preview에서 촬영하는 동작은 플랫폼마다 다릅니다. 촬영이 끝나면 프리뷰를 정리하고 OCR로 넘기는 상태 전환을 명시합니다.

## 엔진과 wrapper를 구분해야 하는 이유

ML Kit는 iOS/Android에서 쓸 수 있고 한국어를 포함한 다섯 문자 체계용 모델을 제공합니다. 그러나 앱이 실제로 인식하는 범위는 wrapper가 포함한 모델과 호출 옵션에 따라 달라집니다. 한국어와 영어가 섞인 문서 결과는 같은 샘플로 검증해야 합니다.

Android bundled 모델은 바로 쓸 수 있는 대신 앱 크기가 늘어납니다. unbundled 모델은 처음에 다운로드가 필요할 수 있습니다. 과제에서는 설치 직후 오프라인 실행과 재현성을 확보하려고 bundled 방식을 먼저 제안합니다.

Apple Vision + Android ML Kit 조합도 가능하나 두 엔진의 결과·언어·오류 차이를 관리해야 합니다. 양쪽 다 ML Kit를 쓰더라도 결과가 글자 단위로 같다는 보장은 없습니다. 기능 패리티와 인식 결과의 동일성은 구분합니다.

Tesseract는 모델과 네이티브 통합을 따로 검토해야 하고 Cloud Vision은 인증·네트워크·이미지 업로드 처리가 더 붙습니다. 현재 요구사항에서는 온디바이스 ML Kit를 우선하는 편이 합리적이라고 봅니다. 엔진 간 정확도 우열을 측정한 것은 아닙니다.

## npm 배포 소스에서 확인한 내용

### @react-native-ml-kit/text-recognition 2.0.0

- iOS/Android에 Latin, Chinese, Devanagari, Japanese, Korean 모델 의존성을 포함합니다.
- script 인자로 recognizer를 선택합니다. 기본값은 Latin입니다.
- iOS podspec은 GoogleMLKit 8.0.0, iOS 15.5를 명시합니다.
- 기존 React Native bridge 모듈입니다. Android build.gradle에서 namespace 선언은 확인하지 못했습니다. 최신 Android Gradle Plugin 조합에서 빌드되는지를 기술 검증 항목으로 둡니다.
- Android는 recognize마다 recognizer를 생성하지만 해당 메서드에 close 호출이 보이지 않습니다. 반복 실행할 때 자원 관리를 검토해야 하며 실제 누수를 재현한 것은 아닙니다.
- ML Kit의 비동기 API를 씁니다. 다만 파일 읽기·디코딩·결과 변환까지 모두 메인 스레드 밖이라고 검증한 것은 아닙니다.

### @infinitered/react-native-mlkit-text-recognition 5.0.1

- Expo Modules 기반입니다.
- 배포된 iOS와 Android 구현은 기본 Latin recognizer를 쓰며 recognizeText에 script 선택 인자가 없습니다.
- ML Kit 엔진이 한국어를 지원한다는 사실만으로 이 wrapper가 한국어를 제공한다고 볼 수는 없습니다. 한국어까지 제공하려면 변경이 필요하므로 현재 우선 후보에서 제외합니다.
- 저장소의 호환성 표는 Expo SDK 54까지 기재돼 있습니다. 최신 SDK 지원 여부는 빌드로 확인해야 합니다.

### rn-mlkit-ocr 0.3.1

- 모델 선택과 Android bundled/unbundled 설정을 제공합니다. 사용량은 비교한 두 wrapper보다 적습니다.
- Android 로컬 파일 경로는 BitmapFactory.decodeFile 후 InputImage.fromBitmap(bitmap, 0)을 씁니다. 이 경로에서 EXIF 회전 반영은 확인하지 못했습니다. EXIF 방향이 붙은 카메라 이미지에서 회전 문제가 생길 가능성이 있으므로 후보로 채택하기 전에 검증해야 합니다.
- 위 내용은 소스에 근거한 우려이며 기기에서 재현한 버그라고 주장하지는 않습니다.

소스는 각 npm registry의 dist.tarball로 제공되는 해당 버전을 읽었습니다. 저장소 main과 배포 버전은 다를 수 있습니다.

## 스펙에 반영할 제안

1. 카메라 프리뷰 → 정지 이미지 파일 → native OCR → 텍스트·이미지 확인 구조를 유지합니다.
2. JS에는 이미지 base64/픽셀 대신 파일 URI와 결과 텍스트를 넘깁니다.
3. 중복 촬영 방지, 작업 식별자, 늦은 결과 무시, 임시 파일 삭제 책임을 정의합니다. Promise timeout은 native 작업 취소와 다릅니다.
4. OCR 연산뿐 아니라 이미지 디코딩·리사이즈·결과 변환의 실행 스레드도 확인합니다.
5. 저조도는 조명/토치와 재촬영 안내, 블러는 초점·촬영 가이드, 회전은 EXIF 방향 처리부터 검증합니다. 원근 보정과 별도 블러 판별기는 샘플 결과를 본 뒤 결정합니다.
6. 정상·저조도·블러·회전·빈 이미지의 고정 샘플과 기대 텍스트를 준비합니다. 정확도와 처리 시간은 측정한 결과만 기록합니다.
7. Android 에뮬레이터 virtual scene에 문서 이미지를 넣어 프리뷰→촬영→OCR 연결을 검증합니다. 별도 이미지 직접 입력 테스트와는 구분합니다.
8. iPhone 17 Pro에서는 반복 촬영, 앱 전환, 권한 변경, 발열·메모리와 UI 반응을 확인합니다. Android 실기기 성능은 미검증으로 남습니다.

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

Cloud Vision OCR은 문서 저조도·블러 전용 결과를 제공하지 않습니다. blurredLikelihood와 underExposedLikelihood는 얼굴 검출 결과입니다. Document AI Enterprise Document OCR은 enableImageQualityScores 옵션으로 dark, blurry 등 결함 정보를 제공합니다. 추가 지연과 오탐이 있어 실제 사진으로 검증합니다. 별도 기울기 결함 항목은 없습니다.

출처: https://docs.cloud.google.com/document-ai/docs/enterprise-document-ocr#image-quality-analysis
