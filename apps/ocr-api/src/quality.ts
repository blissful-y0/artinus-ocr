import type { protos } from '@google-cloud/documentai';

export type QualityWarning = 'LOW_LIGHT' | 'POSSIBLE_BLUR' | 'GLARE' | 'SMALL_TEXT' | 'CROPPED';
const warningOrder: QualityWarning[] = ['LOW_LIGHT', 'POSSIBLE_BLUR', 'GLARE', 'SMALL_TEXT', 'CROPPED'];
const warningByDefect: Readonly<Record<string, QualityWarning>> = {
  'quality/defect_dark': 'LOW_LIGHT',
  'quality/defect_blurry': 'POSSIBLE_BLUR',
  'quality/defect_glare': 'GLARE',
  'quality/defect_text_too_small': 'SMALL_TEXT',
  'quality/defect_document_cutoff': 'CROPPED',
  'quality/defect_text_cutoff': 'CROPPED',
};

export function qualityWarnings(document: protos.google.cloud.documentai.v1.IDocument): QualityWarning[] {
  const detected = new Set<QualityWarning>();
  for (const page of document.pages ?? []) {
    for (const defect of page.imageQualityScores?.detectedDefects ?? []) {
      const confidence = defect.confidence;
      // The app uses an inclusive 0.5 threshold. Scores are not OCR accuracy.
      if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0.5 || confidence > 1) continue;
      const warning = warningByDefect[defect.type ?? ''];
      if (warning) detected.add(warning);
    }
  }
  return warningOrder.filter((warning) => detected.has(warning));
}
