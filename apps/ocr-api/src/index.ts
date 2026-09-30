import { http } from '@google-cloud/functions-framework';
import { createOcrHandler } from './handler';

export { createOcrHandler } from './handler';
export { qualityWarnings } from './quality';

export const ocr = createOcrHandler();
http('ocr', ocr);
