# Google Cloud 연결 상태

확인일: 2026-09-29

## 생성 완료

- 프로젝트 ID: `artinus-ocr`
- 프로젝트 번호: `544173682720`
- Document AI API: 사용 설정 완료
- 프로세서 이름: `artinus-document-ocr`
- 프로세서 유형: Document OCR
- 프로세서 ID: `73989430d5ede014`
- 리전: `us`
- 콘솔 상태: 사용 설정됨
- 처리 엔드포인트: `https://us-documentai.googleapis.com/v1/projects/544173682720/locations/us/processors/73989430d5ede014:process`

위 식별자는 비밀키가 아닙니다. 프로세서 생성 성공은 실제 문서 처리 성공이나 비용·지연 검증을 뜻하지 않습니다.

## 서버 인증 계정 생성 완료

전용 서비스 계정 `artinus-ocr-runtime@artinus-ocr.iam.gserviceaccount.com`을 만들었습니다. Cloud Run 함수에 이 계정을 연결했고 Application Default Credentials로 Document AI를 호출합니다.

`artinus-ocr` 프로젝트 범위에서 `roles/documentai.apiUser`를 부여했습니다. 프로세서 하나에만 제한한 권한은 아닙니다. `gcloud projects get-iam-policy`로 이 계정에 연결된 역할이 그 하나뿐임을 확인했습니다. Document AI 관리자나 프로젝트 편집자 권한은 부여하지 않았습니다.

사용자 관리 서비스 계정 키 목록은 비어 있습니다. 다운로드 가능한 JSON 비밀키는 만들지 않았고 연결된 서비스 계정을 쓰는 배포 방식에는 필요하지도 않습니다.

- [Document AI IAM 역할](https://docs.cloud.google.com/document-ai/docs/access-control/iam-roles)
- [연결된 서비스 계정으로 ADC 제공](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc)

## 배포 설정

- 서비스: `artinus-ocr-api`, 리전 `us-central1`, Node.js 22.
- 검증 리비전: `artinus-ocr-api-00003-n77`, 트래픽 100%.
- 앱 API: `https://artinus-ocr-api-544173682720.us-central1.run.app/ocr`.
- 빌드 계정: `artinus-ocr-build@artinus-ocr.iam.gserviceaccount.com`, `roles/run.builder`.
- 512MiB, CPU 1, 최소 0 / 최대 3 인스턴스, 동시 요청 2, 함수 제한 시간 35초. 평가자 여러 명이 동시에 쓸 때 429가 나는 것을 막으려고 최대 인스턴스를 3으로 올렸으며 인스턴스는 요청이 있을 때만 떠서 유휴 비용은 없습니다.
- 애플리케이션 Bearer 코드 인증. 코드 없는 요청은 401로 거부합니다.
- 인스턴스당 60초에 OCR 시작 10건. 재시작하면 초기화되고 엄격한 비용 상한은 아닙니다.
- SDK 제한 시간 25초, 앱 40초. SDK 자동 재시도는 끕니다.
- 평가코드는 서버 환경변수에만 설정하고 앱에서는 사용자가 입력한 값을 메모리에 보관합니다. Google 비밀키는 만들지 않았습니다.
- 로컬 평가코드는 Git에서 제외된 `artifacts/credentials/ocr-access-code.txt`에 보관합니다. 제출할 때 저장소에 넣지 않고 따로 전달합니다.

재배포: 인증된 gcloud 환경에서 `OCR_ACCESS_TOKEN_FILE=/private/code.txt bash scripts/deploy-gcp.sh`. 다른 프로젝트에 배포하려면 그 프로젝트에 만든 프로세서 ID와 위치도 스크립트에서 바꿔야 합니다.

## 검증 범위

실제 호출 결과와 남은 기기 검증은 [검증 기록](VALIDATION.md)에 적습니다. 프로세서의 기본 버전을 쓰고 버전은 고정하지 않았습니다. 기본 버전이 바뀌면 인식 결과도 달라질 수 있습니다.
