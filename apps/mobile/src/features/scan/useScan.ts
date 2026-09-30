import { useCallback, useEffect, useRef, useState } from "react";
import { deletePhoto, preparePhoto } from "../../services/photoFiles";
import {
  OcrError,
  type OcrProvider,
  type ScanPhoto,
  type ScanState,
} from "./types";

export function useScan(provider: OcrProvider, timeoutMs: number) {
  const [state, setState] = useState<ScanState>({ status: "camera" });
  const current = useRef<ScanState>(state);
  const generation = useRef(0);
  const mounted = useRef(true);
  const pending = useRef<AbortController | null>(null);
  const retained = useRef(
    new Map<string, { readers: number; retired: boolean; photo: ScanPhoto }>(),
  );
  const update = useCallback((next: ScanState) => {
    current.current = next;
    if (mounted.current) setState(next);
  }, []);
  const retire = useCallback((photo: ScanPhoto) => {
    const entry = retained.current.get(photo.uri);
    if (entry?.readers) entry.retired = true;
    else {
      retained.current.delete(photo.uri);
      void deletePhoto(photo);
    }
  }, []);
  const invalidate = useCallback(() => {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
  }, []);
  const retake = useCallback(() => {
    const previous = current.current;
    invalidate();
    if ("photo" in previous) retire(previous.photo);
    update({ status: "camera" });
  }, [invalidate, retire, update]);

  const recognize = useCallback(
    async (photo: ScanPhoto) => {
      invalidate();
      const token = generation.current;
      const controller = new AbortController();
      pending.current = controller;
      const requestId = `${Date.now()}-${token}`;
      update({ status: "processing", photo, requestId });
      const entry = retained.current.get(photo.uri) ?? {
        readers: 0,
        retired: false,
        photo,
      };
      entry.readers += 1;
      retained.current.set(photo.uri, entry);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      // File deletion waits for the provider to settle, even if UI timeout/cancellation wins.
      const work = Promise.resolve()
        .then(() =>
          provider.recognize({ photo, requestId, signal: controller.signal }),
        )
        .finally(() => {
          entry.readers -= 1;
          if (entry.readers === 0 && entry.retired) {
            retained.current.delete(photo.uri);
            void deletePhoto(photo);
          }
        });
      try {
        const result = await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              reject(
                new OcrError(
                  "TIMEOUT",
                  "응답이 늦어지고 있어요. 같은 사진으로 다시 시도해 주세요.",
                  true,
                ),
              );
              controller.abort();
            }, timeoutMs);
          }),
        ]);
        if (mounted.current && generation.current === token)
          update({ status: "success", photo, result });
      } catch (error) {
        if (mounted.current && generation.current === token) {
          update({
            status: "error",
            photo,
            error:
              error instanceof OcrError
                ? error
                : new OcrError(
                    "NETWORK",
                    "연결을 확인하고 다시 시도해 주세요.",
                    true,
                  ),
          });
        }
      } finally {
        clearTimeout(timeout);
        if (generation.current === token) pending.current = null;
      }
    },
    [invalidate, provider, timeoutMs, update],
  );

  const capture = useCallback(
    async (takePhoto: () => Promise<ScanPhoto>) => {
      if (current.current.status !== "camera") return;
      invalidate();
      const token = generation.current;
      update({ status: "capturing" });
      try {
        const photo = await preparePhoto(await takePhoto());
        if (!mounted.current || token !== generation.current) {
          retire(photo);
          return;
        }
        void recognize(photo);
      } catch {
        if (mounted.current && token === generation.current)
          update({
            status: "camera",
            captureError: "사진을 준비하지 못했어요. 다시 촬영해 주세요.",
          });
      }
    },
    [invalidate, recognize, retire, update],
  );
  const retry = useCallback(() => {
    const previous = current.current;
    if (previous.status === "error" && previous.error.retryable)
      void recognize(previous.photo);
  }, [recognize]);
  const interruptCapture = useCallback(() => {
    if (current.current.status === "capturing") retake();
  }, [retake]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidate();
      const previous = current.current;
      if ("photo" in previous) retire(previous.photo);
    };
  }, [invalidate, retire]);
  return { state, capture, retake, retry, interruptCapture };
}
