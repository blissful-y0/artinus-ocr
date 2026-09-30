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

전용 서비스 계정 `artinus-ocr-runtime@artinus-ocr.iam.gserviceaccount.com`을 생성했다. Cloud Run 함수에 이 계정을 연결하고 Application Default Credentials로 Document AI를 호출할 예정이다. 함수 연결은 아직 실행하지 않았다.

`artinus-ocr` 프로젝트 범위에서 `roles/documentai.apiUser`를 부여했다. 프로세서 하나에만 제한한 권한은 아니다. `gcloud projects get-iam-policy`로 이 계정에 연결된 역할이 해당 역할 하나임을 확인했다. Document AI 관리자나 프로젝트 편집자 권한은 부여하지 않았다.

사용자 관리 서비스 계정 키 목록은 비어 있다. 다운로드 가능한 JSON 비밀키는 생성하지 않았으며, 연결된 서비스 계정을 사용하는 배포 방식에는 필요하지 않다.

- [Document AI IAM 역할](https://docs.cloud.google.com/document-ai/docs/access-control/iam-roles)
- [연결된 서비스 계정으로 ADC 제공](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc)

## 남은 작업

- Cloud Run 함수에 생성된 서비스 계정 연결
- 프로세서 버전 확인과 `enableImageQualityScores` 실제 응답 검증
- 앱에서 함수를 호출하는 인증 및 호출 제한 구현
- TypeScript 함수와 모바일 remote provider 구현·배포
- 실제 이미지의 OCR·품질 경고·처리 시간 검증

현재 앱의 remote provider는 설정 오류로 종료하는 상태다. 실제 OCR 호출이나 서버 배포를 완료했다고 간주하지 않는다.
