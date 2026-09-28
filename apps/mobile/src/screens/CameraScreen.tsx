import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ScanPhoto } from "../features/scan/types";

type Props = {
  active: boolean;
  capturing: boolean;
  captureError?: string;
  onCapture: (takePhoto: () => Promise<ScanPhoto>) => void;
  children?: ReactNode;
};
export function CameraScreen({
  active,
  capturing,
  captureError,
  onCapture,
  children,
}: Props) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [cameraError, setCameraError] = useState<string>();
  const [cameraKey, setCameraKey] = useState(0);
  const [permissionBusy, setPermissionBusy] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active")
        void getPermission().catch(() =>
          setCameraError("카메라 권한을 확인하지 못했어요."),
        );
    });
    return () => subscription.remove();
  }, [getPermission]);
  useEffect(() => {
    if (!active) {
      setReady(false);
      setTorch(false);
    }
  }, [active]);
  useEffect(() => {
    if (!permission?.granted) {
      setReady(false);
      setTorch(false);
    }
  }, [permission?.granted]);
  const askPermission = async () => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    try {
      await requestPermission();
    } catch {
      setCameraError("카메라 권한을 요청하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setPermissionBusy(false);
    }
  };
  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      setCameraError("설정 앱에서 카메라 권한을 허용해 주세요.");
    }
  };
  const capture = () => {
    if (!ready || capturing || !active || !camera.current) return;
    onCapture(async () => {
      const photo = await camera.current?.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        exif: false,
      });
      if (!photo) throw new Error("Capture unavailable");
      return { uri: photo.uri, width: photo.width, height: photo.height };
    });
  };
  return (
    <View style={styles.screen} testID="camera-screen">
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>ARTINUS OCR</Text>
        <Text style={styles.title}>사진 속 글자 읽기</Text>
        <Text style={styles.description}>
          글자가 선명하게 보이도록 맞춰 주세요.
        </Text>
      </View>
      <View style={styles.preview}>
        {!permission ? (
          <ActivityIndicator color="#fff" />
        ) : !permission.granted ? (
          <View style={styles.permission}>
            <Text style={styles.permissionTitle}>카메라 접근이 필요해요</Text>
            <Text style={styles.permissionText}>
              글자를 촬영하려면 카메라 권한을 허용해 주세요.
            </Text>
            <Pressable
              accessibilityRole="button"
              testID={
                permission.canAskAgain
                  ? "camera-permission-request"
                  : "camera-permission-settings"
              }
              disabled={permissionBusy}
              style={styles.permissionButton}
              onPress={permission.canAskAgain ? askPermission : openSettings}
            >
              <Text style={styles.buttonText}>
                {permission.canAskAgain ? "카메라 권한 허용" : "설정 열기"}
              </Text>
            </Pressable>
          </View>
        ) : cameraError ? (
          <View style={styles.permission}>
            <Text style={styles.permissionText}>{cameraError}</Text>
            <Pressable
              testID="camera-retry"
              accessibilityRole="button"
              style={styles.permissionButton}
              onPress={() => {
                setReady(false);
                setCameraError(undefined);
                setCameraKey((value) => value + 1);
              }}
            >
              <Text style={styles.buttonText}>카메라 다시 열기</Text>
            </Pressable>
          </View>
        ) : active ? (
          <>
            <CameraView
              key={cameraKey}
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              enableTorch={torch}
              autofocus="on"
              onCameraReady={() => setReady(true)}
              onMountError={() => {
                setReady(false);
                setCameraError(
                  "카메라를 열지 못했어요. 다른 앱의 카메라 사용을 종료하고 다시 시도해 주세요.",
                );
              }}
            />
            {!ready && <ActivityIndicator color="#fff" />}
            <View pointerEvents="none" style={styles.hint}>
              <Text style={styles.hintText}>
                전체 사진의 텍스트를 인식합니다
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.permissionText}>
            앱으로 돌아오면 카메라를 다시 켭니다.
          </Text>
        )}
      </View>
      {captureError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {captureError}
        </Text>
      )}
      {!permission?.granted && cameraError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {cameraError}
        </Text>
      )}
      <View style={styles.actions}>
        <Pressable
          testID="camera-torch"
          accessibilityRole="button"
          accessibilityLabel={torch ? "조명 끄기" : "조명 켜기"}
          accessibilityState={{
            disabled: !ready || capturing,
            selected: torch,
          }}
          disabled={!ready || capturing}
          style={[styles.torch, (!ready || capturing) && styles.disabled]}
          onPress={() => setTorch((value) => !value)}
        >
          <Text style={styles.torchText}>
            {torch ? "조명 끄기" : "조명 켜기"}
          </Text>
        </Pressable>
        <Pressable
          testID="camera-capture"
          accessibilityRole="button"
          accessibilityLabel="촬영"
          accessibilityState={{ disabled: !ready || capturing || !active }}
          disabled={!ready || capturing || !active}
          onPress={capture}
          style={[
            styles.capture,
            (!ready || capturing || !active) && styles.disabled,
          ]}
        >
          {capturing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>촬영</Text>
          )}
        </Pressable>
      </View>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  heading: { gap: 6 },
  eyebrow: {
    color: "#315cc9",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  title: { fontSize: 25, fontWeight: "700", color: "#142139" },
  description: { color: "#516079", fontSize: 14 },
  preview: {
    flex: 1,
    minHeight: 150,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#172236",
    alignItems: "center",
    justifyContent: "center",
  },
  permission: { padding: 24, alignItems: "center", gap: 14 },
  permissionTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
  permissionText: { color: "#e2e8f3", textAlign: "center", lineHeight: 22 },
  permissionButton: {
    backgroundColor: "#315cc9",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  hint: {
    position: "absolute",
    bottom: 20,
    backgroundColor: "#172236cc",
    borderRadius: 9,
    padding: 10,
  },
  hintText: { color: "#fff", fontSize: 12 },
  actions: { flexDirection: "row", gap: 12 },
  torch: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#e4eaf7",
    borderRadius: 14,
  },
  torchText: { color: "#253b64", fontWeight: "600" },
  capture: {
    flex: 1,
    minHeight: 52,
    backgroundColor: "#315cc9",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  error: { color: "#b33737", fontSize: 13 },
});
