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
import {
  MOCK_TIMEOUT_MS,
  REMOTE_TIMEOUT_MS,
} from "./src/features/scan/constants";
import { CAPTURE_MESSAGES } from "./src/features/scan/messages";
import { useScan } from "./src/features/scan/useScan";
import { CameraScreen } from "./src/screens/CameraScreen";
import { ResultScreen } from "./src/screens/ResultScreen";
import { AccessCodeScreen } from "./src/screens/AccessCodeScreen";
import {
  createMockOcrProvider,
  MOCK_SCENARIOS,
} from "./src/services/mockOcrProvider";
import { copyFixture, initializePhotoFiles } from "./src/services/photoFiles";
import { createRemoteOcrProvider } from "./src/services/remoteOcrProvider";

const mockMode = process.env.EXPO_PUBLIC_OCR_MODE !== "remote";
const fixtureEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_FIXTURE === "true";
function Scanner({
  accessCode,
  onChangeCode,
}: {
  accessCode: string;
  onChangeCode: () => void;
}) {
  const [scenario, setScenario] = useState<MockScenario>("success");
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const provider = useMemo(
    () =>
      mockMode
        ? createMockOcrProvider(scenario)
        : createRemoteOcrProvider(
            process.env.EXPO_PUBLIC_OCR_API_URL,
            accessCode,
          ),
    [scenario, accessCode],
  );
  const scan = useScan(
    provider,
    mockMode ? MOCK_TIMEOUT_MS : REMOTE_TIMEOUT_MS,
  );
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
      {!mockMode && (
        <View style={styles.remoteHeader}>
          <Pressable
            testID="remote-change-code"
            accessibilityRole="button"
            onPress={() => {
              scan.retake();
              onChangeCode();
            }}
            style={styles.changeCode}
          >
            <Text style={styles.fixtureText}>코드 변경</Text>
          </Pressable>
          <Text style={styles.remoteNotice}>
            {scan.state.status === "error" &&
            scan.state.error.code === "UNAUTHORIZED"
              ? "인증에 실패했어요. 코드를 다시 입력해 주세요."
              : "사진을 클라우드로 전송해 인식합니다."}
          </Text>
        </View>
      )}
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
              {/* Collapsed by default so the preview keeps the screen. The
                  notice itself stays visible: mock results must never look real. */}
              <Pressable
                testID="mock-panel-toggle"
                accessibilityRole="button"
                accessibilityState={{ expanded: scenariosOpen }}
                onPress={() => setScenariosOpen((open) => !open)}
                style={styles.mockHeader}
              >
                <Text testID="mock-mode-notice" style={styles.mockTitle}>
                  개발용 모의 OCR · 실제 인식 결과가 아닙니다
                </Text>
                <Text style={styles.mockToggle}>
                  {scenariosOpen ? "접기" : "시나리오"}
                </Text>
              </Pressable>
              <View style={[styles.scenarios, !scenariosOpen && styles.hidden]}>
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
            </View>
          )}
          {fixtureEnabled && (
            <Pressable
              testID="fixture-capture"
              accessibilityRole="button"
              disabled={scan.state.status === "capturing"}
              onPress={captureFixture}
              style={styles.fixture}
            >
              <Text style={styles.fixtureText}>
                {mockMode
                  ? "샘플 이미지로 흐름 테스트 (카메라 검증 제외)"
                  : "개발용 샘플 이미지를 서버로 전송"}
              </Text>
            </Pressable>
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
  const [accessCode, setAccessCode] = useState<string | null>(null);
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
        !mockMode && accessCode === null ? (
          <AccessCodeScreen onContinue={setAccessCode} />
        ) : (
          <Scanner
            accessCode={accessCode ?? ""}
            onChangeCode={() => setAccessCode(null)}
          />
        )
      ) : (
        <View style={styles.loading}>
          {error ? (
            <>
              <Text>{CAPTURE_MESSAGES.storageSetupFailed}</Text>
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
  remoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 12,
  },
  remoteNotice: { flex: 1, color: "#516079", fontSize: 12, lineHeight: 18 },
  changeCode: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  mockPanel: {
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fff3d4",
    gap: 8,
  },
  mockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 32,
  },
  mockTitle: {
    color: "#72531a",
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  mockToggle: { color: "#8a6410", fontSize: 11, fontWeight: "700" },
  hidden: { display: "none" },
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
