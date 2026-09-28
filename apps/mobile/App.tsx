import { Asset } from "expo-asset";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { MockScenario } from "./src/features/scan/types";
import { useScan } from "./src/features/scan/useScan";
import { CameraScreen } from "./src/screens/CameraScreen";
import { ResultScreen } from "./src/screens/ResultScreen";
import {
  createMockOcrProvider,
  MOCK_SCENARIOS,
} from "./src/services/mockOcrProvider";
import { copyFixture, initializePhotoFiles } from "./src/services/photoFiles";
import { remoteOcrProvider } from "./src/services/remoteOcrProvider";

const mockMode = process.env.EXPO_PUBLIC_OCR_MODE !== "remote";
const fixtureEnabled =
  mockMode && process.env.EXPO_PUBLIC_ENABLE_FIXTURE === "true";
function Scanner() {
  const [scenario, setScenario] = useState<MockScenario>("success");
  const [active, setActive] = useState(AppState.currentState === "active");
  const provider = useMemo(
    () => (mockMode ? createMockOcrProvider(scenario) : remoteOcrProvider),
    [scenario],
  );
  const scan = useScan(provider, mockMode ? 10_000 : 30_000);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      setActive(next === "active");
      if (next !== "active") scan.interruptCapture();
    });
    return () => subscription.remove();
  }, [scan.interruptCapture]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (scan.state.status === "camera") return false;
        scan.retake();
        return true;
      },
    );
    return () => subscription.remove();
  }, [scan.state.status, scan.retake]);
  const captureFixture = () =>
    scan.capture(async () => {
      const asset = await Asset.fromModule(
        require("./assets/ocr-fixture.png"),
      ).downloadAsync();
      if (!asset.localUri) throw new Error("Fixture unavailable");
      return copyFixture(asset.localUri);
    });
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      {scan.state.status === "camera" || scan.state.status === "capturing" ? (
        <CameraScreen
          active={active}
          capturing={scan.state.status === "capturing"}
          captureError={
            scan.state.status === "camera" ? scan.state.captureError : undefined
          }
          onCapture={scan.capture}
        >
          {mockMode && (
            <View style={styles.mockPanel}>
              <Text testID="mock-mode-notice" style={styles.mockTitle}>
                개발용 모의 OCR · 실제 인식 결과가 아닙니다
              </Text>
              <View style={styles.scenarios}>
                {MOCK_SCENARIOS.map((item) => (
                  <Pressable
                    key={item.value}
                    testID={`scenario-${item.value}`}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: scenario === item.value,
                      disabled: scan.state.status === "capturing",
                    }}
                    disabled={scan.state.status === "capturing"}
                    onPress={() => setScenario(item.value)}
                    style={[
                      styles.scenario,
                      scenario === item.value && styles.selectedScenario,
                    ]}
                  >
                    <Text style={styles.scenarioText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              {fixtureEnabled && (
                <Pressable
                  testID="fixture-capture"
                  accessibilityRole="button"
                  disabled={scan.state.status === "capturing"}
                  onPress={captureFixture}
                  style={styles.fixture}
                >
                  <Text style={styles.fixtureText}>
                    샘플 이미지로 흐름 테스트 (카메라 검증 제외)
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </CameraScreen>
      ) : (
        <ResultScreen
          state={scan.state}
          onRetake={scan.retake}
          onRetry={scan.retry}
          mockMode={mockMode}
        />
      )}
    </SafeAreaView>
  );
}
export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const initialize = () => {
    setError(false);
    void initializePhotoFiles()
      .then(() => setReady(true))
      .catch(() => setError(true));
  };
  useEffect(initialize, []);
  return (
    <SafeAreaProvider>
      {ready ? (
        <Scanner />
      ) : (
        <View style={styles.loading}>
          {error ? (
            <>
              <Text>임시 사진 저장 공간을 준비하지 못했어요.</Text>
              <Pressable accessibilityRole="button" onPress={initialize}>
                <Text style={styles.fixtureText}>다시 시도</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color="#315cc9" />
          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f7fb" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  mockPanel: {
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fff3d4",
    gap: 8,
  },
  mockTitle: { color: "#72531a", fontSize: 11, fontWeight: "600" },
  scenarios: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  scenario: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff9eb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4d8b9",
  },
  selectedScenario: { backgroundColor: "#f7d581", borderColor: "#9a721c" },
  scenarioText: { color: "#60491b", fontSize: 12 },
  fixture: { paddingVertical: 7 },
  fixtureText: { color: "#315cc9", fontWeight: "600", fontSize: 12 },
});
