export type OcrConfiguration = {
  project: string;
  location: string;
  processorId: string;
  processorVersion?: string;
  accessToken: string;
};

export function readConfiguration(environment: NodeJS.ProcessEnv = process.env): OcrConfiguration {
  return {
    project: environment.GOOGLE_CLOUD_PROJECT ?? '',
    location: environment.DOCUMENT_AI_LOCATION ?? '',
    processorId: environment.DOCUMENT_AI_PROCESSOR_ID ?? '',
    processorVersion: environment.DOCUMENT_AI_PROCESSOR_VERSION || undefined,
    accessToken: environment.OCR_ACCESS_TOKEN ?? '',
  };
}

export function isConfigured(configuration: OcrConfiguration): boolean {
  return /^[a-z0-9-]+$/.test(configuration.project)
    && /^[a-z0-9-]+$/.test(configuration.location)
    && /^[a-z0-9]+$/.test(configuration.processorId)
    && (!configuration.processorVersion || /^[a-zA-Z0-9._-]+$/.test(configuration.processorVersion))
    && configuration.accessToken.length > 0
    && !/\s/.test(configuration.accessToken);
}

export function processorName(configuration: OcrConfiguration): string {
  const name = `projects/${configuration.project}/locations/${configuration.location}/processors/${configuration.processorId}`;
  return configuration.processorVersion ? `${name}/processorVersions/${configuration.processorVersion}` : name;
}
