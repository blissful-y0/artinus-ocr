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

위 식별자는 비밀키가 아니다. 프로세서 생성 성공은 실제 문서 처리 성공이나 비용·지연 검증을 의미하지 않는다.

## 서버 인증 계정 생성 완료

전용 서비스 계정 `artinus-ocr-runtime@artinus-ocr.iam.gserviceaccount.com`을 생성했다. Cloud Run 함수에 이 계정을 연결했고 Application Default Credentials로 Document AI를 호출한다.

`artinus-ocr` 프로젝트 범위에서 `roles/documentai.apiUser`를 부여했다. 프로세서 하나에만 제한한 권한은 아니다. `gcloud projects get-iam-policy`로 이 계정에 연결된 역할이 해당 역할 하나임을 확인했다. Document AI 관리자나 프로젝트 편집자 권한은 부여하지 않았다.

사용자 관리 서비스 계정 키 목록은 비어 있다. 다운로드 가능한 JSON 비밀키는 생성하지 않았으며, 연결된 서비스 계정을 사용하는 배포 방식에는 필요하지 않다.

- [Document AI IAM 역할](https://docs.cloud.google.com/document-ai/docs/access-control/iam-roles)
- [연결된 서비스 계정으로 ADC 제공](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc)

## 배포 설정

- 서비스: `artinus-ocr-api`, 리전 `us-central1`, Node.js 22.
- 검증 리비전: `artinus-ocr-api-00002-np4`, 트래픽 100%.
- 앱 API: `https://artinus-ocr-api-544173682720.us-central1.run.app/ocr`.
- 빌드 계정: `artinus-ocr-build@artinus-ocr.iam.gserviceaccount.com`, `roles/run.builder`.
- 512MiB, CPU 1, 최소 0 / 최대 1 인스턴스, 동시 요청 2, 함수 제한 시간 35초.
- 애플리케이션 Bearer 코드 인증. 코드 없는 요청은 401로 거부한다.
- 인스턴스당 60초에 OCR 시작 10건. 재시작 시 초기화되며 엄격한 비용 상한은 아니다.
- SDK 제한 시간 25초, 앱 40초. SDK 자동 재시도는 끈다.
- 평가코드는 서버 환경변수에만 설정하고, 앱에서는 사용자가 입력한 값을 메모리에 보관한다. Google 비밀키는 만들지 않았다.
- 로컬 평가코드는 Git에서 제외된 `artifacts/credentials/ocr-access-code.txt`에 보관한다. 제출 시 저장소에 넣지 않고 별도로 전달한다.

재배포: 인증된 gcloud 환경에서 `OCR_ACCESS_TOKEN_FILE=/private/code.txt bash scripts/deploy-gcp.sh`. 다른 프로젝트에 배포하려면 해당 프로젝트에 만든 프로세서 ID와 위치도 스크립트에서 바꿔야 한다.

## 검증 범위

실제 호출 결과와 남은 기기 검증은 [검증 기록](VALIDATION.md)에 기록한다. 프로세서의 기본 버전을 사용하며 버전은 고정하지 않았다. 따라서 향후 기본 버전 변경 시 인식 결과가 달라질 수 있다.
