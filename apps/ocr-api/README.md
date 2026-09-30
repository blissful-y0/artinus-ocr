# OCR 중계 함수

TypeScript Cloud Run 함수 `ocr`는 JPEG 사진을 Google Document AI로 전달하고 인식문과 품질 경고를 반환합니다. Google API 키나 서비스 계정 키 파일을 사용하지 않습니다. 배포된 함수에 연결된 `artinus-ocr-runtime@artinus-ocr.iam.gserviceaccount.com`의 [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials)를 사용합니다.

## 로컬 실행과 검증

Node.js 22가 필요합니다. 패키지와 잠금 파일은 Document AI 10.1.1, Functions Framework 5.0.5 버전을 고정합니다.

```sh
cd apps/ocr-api
npm ci
npm run typecheck
npm test
cp .env.example .env
# .env의 OCR_ACCESS_TOKEN을 평가용 접근 코드로 채웁니다.
npm run build
node --env-file=.env node_modules/@google-cloud/functions-framework/build/src/main.js --target=ocr
```

기본 포트는 8080입니다. `GET http://localhost:8080/health`는 인증 없이 `{ "ok": true }`를 반환하는 생존 검사입니다. 프로젝트·프로세서·접근 코드나 OCR 연결 성공 여부를 반환하지 않습니다.

`npm test`는 실제 Functions Framework HTTP 서버에 주입한 Document AI 대체 클라이언트를 사용합니다. 인증 누락·오류와 설정 누락, 정상·빈 결과, JPEG·base64·5MiB 이미지와 7MiB JSON 경계, 품질 경고 경계값, 호출·동시 처리 제한, 외부 오류 변환을 검증합니다. Google API를 호출하지 않습니다. 로컬에서 실제 OCR을 호출하려면 별도로 ADC와 Document AI 처리 권한이 필요합니다. 실제 배포·사진 인식 결과는 [검증 기록](../../docs/VALIDATION.md)과 [GCP 연결 상태](../../docs/GCP_SETUP.md)에 기록합니다.

## 요청과 응답

`POST /` 또는 `POST /ocr`에 압축하지 않은 `application/json`을 보냅니다. 인증 헤더는 `Authorization: Bearer <평가용 접근 코드>`입니다. 접근 코드는 서버의 `OCR_ACCESS_TOKEN`과 비교하며, 고정 길이 SHA-256 값을 상수시간 비교합니다. 서버 설정이 없으면 외부 OCR 호출을 차단합니다. 접근 코드는 Google 자격증명이 아니며 앱 사용자가 별도로 입력합니다.

```json
{
  "requestId": "scan-1",
  "imageBase64": "<JPEG의 표준 base64 문자열>",
  "mimeType": "image/jpeg"
}
```

`requestId`는 1~128자 문자열입니다. base64는 표준 알파벳과 필요한 패딩을 사용해야 합니다. 디코딩한 사진은 최대 5MiB, 전체 JSON 본문은 최대 7MiB입니다. JPEG 시작 시그니처를 검사하며 이미지 전체 디코딩·픽셀 수 검사는 수행하지 않습니다. 실제 이미지의 유효성은 Document AI가 추가로 확인합니다.

```json
{
  "requestId": "scan-1",
  "text": "인식한 문장",
  "warnings": ["LOW_LIGHT", "POSSIBLE_BLUR"],
  "source": "remote"
}
```

텍스트가 없으면 HTTP 200과 빈 문자열을 반환합니다. 품질 경고가 있어도 인식문을 제공합니다. 오류 응답은 `{ "error": { "code": "...", "message": "...", "retryable": false } }` 형식입니다.

| HTTP | 오류 코드 | 재시도 |
| --- | --- | --- |
| 400 | `INVALID_IMAGE`: 요청·사진 형식 오류 | 불가, 재촬영 또는 요청 수정 |
| 401 | `UNAUTHORIZED`: 접근 코드 오류 | 불가, 코드 다시 입력 |
| 413 / 415 | `INVALID_IMAGE`: 크기 초과 / 지원하지 않는 형식 | 불가, 재촬영 또는 요청 수정 |
| 429 | `RATE_LIMITED`: 호출·동시 처리·서비스 한도 | 가능, `Retry-After` 이후 |
| 500 | `CONFIGURATION`: 서버 설정·권한·프로세서 문제 | 불가, 서버 설정 확인 |
| 502 | `SERVER`: 서비스 실패·정상 결과 누락 | 가능 |
| 504 | `TIMEOUT`: OCR 처리 시간 초과 | 가능 |

다른 경로는 404, POST가 아닌 처리 요청은 405를 반환합니다. 함수 코드에서 사진, base64, 인식문, 인증 헤더와 외부 오류 원문을 로그에 남기거나 저장하지 않습니다. 서버의 고정 오류 안내문만 클라이언트에 전달합니다.

## Document AI 설정과 품질 경고

| 서버 환경변수 | 값 |
| --- | --- |
| `GOOGLE_CLOUD_PROJECT` | `artinus-ocr` |
| `DOCUMENT_AI_LOCATION` | `us` |
| `DOCUMENT_AI_PROCESSOR_ID` | `73989430d5ede014` |
| `DOCUMENT_AI_PROCESSOR_VERSION` | 선택 사항, 비어 있으면 프로세서 기본 버전 |
| `OCR_ACCESS_TOKEN` | 별도 생성한 평가용 접근 코드, 저장소에 포함하지 않음 |

호출은 `us-documentai.googleapis.com`을 사용합니다. [OCR 설정](https://docs.cloud.google.com/document-ai/docs/enterprise-document-ocr)에 따라 `processOptions.ocrConfig.enableImageQualityScores=true`를 설정합니다. [처리 요청의 `imagelessMode`](https://docs.cloud.google.com/document-ai/docs/reference/rest/v1/projects.locations.processors/process)를 활성화하고 응답 필드를 `text`, `pages.image_quality_scores`로 제한합니다. 이미지가 없는 응답은 입력 이미지를 보내지 않는다는 뜻이 아닙니다. [SDK 호출 옵션](https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html)은 `timeout=25000`, `retry=null`이며 SDK 자동 재시도를 하지 않습니다. `retry=null`과 `maxRetries`를 함께 지정하면 현재 SDK의 옵션 병합이 실패하므로 `maxRetries`를 추가하지 않습니다. 실제 `google-gax` 클래스의 병합 동작을 회귀 테스트로 확인합니다.

| Document AI 결함 | 앱 경고 |
| --- | --- |
| `quality/defect_dark` | `LOW_LIGHT` |
| `quality/defect_blurry` | `POSSIBLE_BLUR` |
| `quality/defect_glare` | `GLARE` |
| `quality/defect_text_too_small` | `SMALL_TEXT` |
| `quality/defect_document_cutoff`, `quality/defect_text_cutoff` | `CROPPED` |

앱 정책은 결함별 `confidence >= 0.5`를 경고로 변환하며 같은 경고를 한 번만 반환합니다. 공식 설명의 양성 기준은 `> 0.5`이고, 이 앱은 경계값 0.5를 포함합니다. `qualityScore`는 OCR 정확도 퍼센트가 아닙니다. `noisy`, `faint` 등 다른 결함을 임의로 저조도·블러 경고로 바꾸지 않습니다. 경고 오탐·누락과 실제 사진에서의 감지 정확도는 별도 검증 대상입니다.

## 배포와 제한

프로젝트 결제와 Document AI, Cloud Run, Cloud Build, Artifact Registry API가 필요합니다. [Cloud Run 소스 배포](https://docs.cloud.google.com/run/docs/deploy-functions)는 빌드 서비스 계정과 런타임 서비스 계정을 구분합니다. 런타임 계정에는 Document AI 문서 처리 역할이 필요합니다.

저장소 루트의 [배포 스크립트](../../scripts/deploy-gcp.sh)는 비공개 파일에서 평가용 코드를 읽어 임시 환경 설정 파일로 전달합니다. 코드 값을 CLI 인자나 소스 업로드에 넣지 않습니다.

```sh
# 저장소 루트에서 실행
OCR_ACCESS_TOKEN_FILE=/비공개/경로/접근코드파일 ./scripts/deploy-gcp.sh
```

배포 구성은 Node.js 22, 함수 엔트리 `ocr`, 메모리 512MiB, 동시 요청 2, 최소 인스턴스 0, 최대 인스턴스 1, HTTP 제한 35초입니다. `gcp-build`에서 TypeScript 소스를 컴파일합니다. `.gcloudignore`는 `node_modules`, `dist`, 테스트, `.env` 파일을 업로드에서 제외합니다. 생성된 `dist/index.js`가 함수 패키지의 진입점입니다.

메모리 제한은 인스턴스 전체에서 60초 동안 OCR 시작 10회, 진행 중 OCR 2회입니다. 잘못된 인증·입력과 한도로 거절한 요청은 OCR을 호출하지 않습니다. 이 수치는 분산된 영구 한도가 아니며 인스턴스 재시작·새 리비전 배포 시 초기화됩니다. 최대 인스턴스 1도 엄밀한 과금 상한을 보장하지 않습니다.

7MiB 검사는 함수의 `rawBody`와 `Content-Length`를 사용합니다. [Functions Framework 파서](https://github.com/GoogleCloudPlatform/functions-framework-nodejs/blob/main/src/server.ts)는 함수 호출 전에 본문을 파싱하고 자체 제한으로 1024mb를 사용하므로, 이 검사는 파싱 전 메모리 사용을 7MiB로 제한하지 않습니다. 프레임워크가 먼저 거절한 잘못된 JSON 등은 함수의 오류 응답 계약을 거치지 않습니다. 공개 서비스의 엄격한 유입 용량 제한·분산 호출 제한은 별도 앞단이 필요합니다.
