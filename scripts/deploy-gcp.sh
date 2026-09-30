#!/usr/bin/env bash
# Requires an authenticated gcloud CLI, Node.js 22+, and an active billing account.
# Publishes an HTTPS endpoint protected by the function's evaluation access code.
set -euo pipefail
set +x
umask 077

task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_project="${GCP_PROJECT_ID:-artinus-ocr}"
task_region="${GCP_REGION:-us-central1}"
task_service="artinus-ocr-api"
task_runtime="artinus-ocr-runtime@${task_project}.iam.gserviceaccount.com"
task_builder="artinus-ocr-build@${task_project}.iam.gserviceaccount.com"

command -v gcloud >/dev/null
command -v node >/dev/null
if [[ "$(gcloud billing projects describe "$task_project" --format='value(billingEnabled)')" != "True" ]]; then
  echo "Billing is not enabled for ${task_project}. Link an active billing account first." >&2
  exit 1
fi

# The token is supplied separately, never included in the source upload or CLI arguments.
: "${OCR_ACCESS_TOKEN_FILE:?Set OCR_ACCESS_TOKEN_FILE to a private file containing the evaluation code}"
task_env_file="$(mktemp)"
trap 'rm -f "$task_env_file"' EXIT
node - "$OCR_ACCESS_TOKEN_FILE" "$task_env_file" "$task_project" <<'NODE'
const fs = require('node:fs');
const [tokenFile, envFile, project] = process.argv.slice(2);
const token = fs.readFileSync(tokenFile, 'utf8').trim();
if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
  throw new Error('Use a randomly generated 32–128 character base64url access code.');
}
fs.writeFileSync(envFile, JSON.stringify({
  GOOGLE_CLOUD_PROJECT: project,
  DOCUMENT_AI_LOCATION: 'us',
  DOCUMENT_AI_PROCESSOR_ID: '73989430d5ede014',
  OCR_ACCESS_TOKEN: token,
}), {mode: 0o600});
NODE

gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com logging.googleapis.com documentai.googleapis.com \
  --project="$task_project"

# List first so unrelated permission/connection errors are not mistaken for an absent account.
task_accounts="$(gcloud iam service-accounts list --project="$task_project" --format='value(email)')"
if ! printf '%s\n' "$task_accounts" | grep -Fxq "$task_runtime"; then
  gcloud iam service-accounts create artinus-ocr-runtime --project="$task_project" \
    --display-name='ARTINUS OCR runtime'
fi
if ! printf '%s\n' "$task_accounts" | grep -Fxq "$task_builder"; then
  gcloud iam service-accounts create artinus-ocr-build --project="$task_project" \
    --display-name='ARTINUS OCR build'
fi
gcloud projects add-iam-policy-binding "$task_project" \
  --member="serviceAccount:${task_runtime}" --role=roles/documentai.apiUser \
  --condition=None --format='value(version)'
gcloud projects add-iam-policy-binding "$task_project" \
  --member="serviceAccount:${task_builder}" --role=roles/run.builder \
  --condition=None --format='value(version)'

gcloud run deploy "$task_service" --project="$task_project" --region="$task_region" \
  --source="$task_root/apps/ocr-api" --function=ocr --base-image=nodejs22 \
  --build-service-account="projects/${task_project}/serviceAccounts/${task_builder}" \
  --service-account="$task_runtime" --env-vars-file="$task_env_file" \
  --memory=512Mi --cpu=1 --concurrency=2 --min=0 --max=1 --max-instances=1 \
  --timeout=35s --no-invoker-iam-check --quiet

gcloud run services describe "$task_service" --project="$task_project" \
  --region="$task_region" --format='value(status.url)'
