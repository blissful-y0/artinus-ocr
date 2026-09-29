import {
  ImageManipulator,
  SaveFormat,
  type ImageRef,
  type ImageManipulatorContext,
} from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import type { ScanPhoto } from "../features/scan/types";

const directory = `${FileSystem.cacheDirectory}artinus-scans/`;
export async function initializePhotoFiles() {
  await FileSystem.deleteAsync(directory, { idempotent: true });
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
}
export async function deletePhoto(photo: ScanPhoto) {
  await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(
    () => undefined,
  );
}
// Expo Camera rotates pixels to the device orientation by default (skipProcessing=false).
// Native image manipulation bounds dimensions without moving pixels through JS.
// Remote transport encodes this prepared file as base64 separately.
export async function preparePhoto(photo: ScanPhoto): Promise<ScanPhoto> {
  let transformedUri: string | undefined;
  let context: ImageManipulatorContext | undefined;
  let rendered: ImageRef | undefined;
  try {
    context = ImageManipulator.manipulate(photo.uri);
    if (Math.max(photo.width, photo.height) > 2400) {
      context.resize(
        photo.width >= photo.height ? { width: 2400 } : { height: 2400 },
      );
    }
    rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.85,
    });
    transformedUri = saved.uri;
    const uri = `${directory}${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    await FileSystem.copyAsync({ from: saved.uri, to: uri });
    return { uri, width: saved.width, height: saved.height };
  } finally {
    rendered?.release();
    context?.release();
    await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(
      () => undefined,
    );
    if (transformedUri)
      await FileSystem.deleteAsync(transformedUri, { idempotent: true }).catch(
        () => undefined,
      );
  }
}
export async function copyFixture(uri: string): Promise<ScanPhoto> {
  const destination = `${directory}fixture-${Date.now()}.png`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return { uri: destination, width: 960, height: 1280 };
}
