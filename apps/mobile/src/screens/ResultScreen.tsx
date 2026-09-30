import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { QualityWarning, ResultScreenProps } from "../features/scan/types";
import { PhotoViewer } from "./PhotoViewer";

const WARNING_COPY: Record<QualityWarning, { title: string; detail: string }> =
  {
    LOW_LIGHT: {
      title: "어두운 사진",
      detail: "밝은 곳에서 글자가 잘 보이도록 촬영해 주세요.",
    },
    POSSIBLE_BLUR: {
      title: "흐림 가능성",
      detail: "카메라를 고정하고 초점이 맞은 뒤 촬영해 주세요.",
    },
    GLARE: {
      title: "빛 반사 가능성",
      detail: "빛이 글자를 가리지 않도록 촬영 각도를 바꿔 주세요.",
    },
    SMALL_TEXT: {
      title: "작은 글자",
      detail: "글자가 충분히 크게 보이도록 가까이 촬영해 주세요.",
    },
    CROPPED: {
      title: "잘린 내용 가능성",
      detail: "필요한 글자가 모두 사진 안에 들어오도록 촬영해 주세요.",
    },
  };

function WarningList({ warnings }: { warnings: QualityWarning[] }) {
  return (
    <>
      {warnings.map((warning) => (
        <View
          style={styles.warningRow}
          key={warning}
          testID={`result-warning-${warning}`}
        >
          <View style={styles.warningMarker} accessible={false}>
            <Text style={styles.warningMarkerText}>!</Text>
          </View>
          <View style={styles.warningText}>
            <Text style={styles.warningTitle}>
              {WARNING_COPY[warning].title}
            </Text>
            <Text style={styles.warningDetail}>
              {WARNING_COPY[warning].detail}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

export function ResultScreen({
  state,
  onRetake,
  onRetry,
  mockMode,
}: ResultScreenProps) {
  const [photoVisible, setPhotoVisible] = useState(false);
  const result = state.status === "success" ? state.result : null;
  const isMock = mockMode || result?.source === "mock";
  const warnings = result ? [...new Set(result.warnings)] : [];
  const hasText = result !== null && result.text.trim().length > 0;
  const canRetry = state.status === "error" && state.error.retryable;

  useEffect(() => {
    setPhotoVisible(false);
  }, [state.photo.uri]);

  function retake() {
    setPhotoVisible(false);
    onRetake();
  }

  return (
    <View style={styles.screen} testID="result-screen">
      <View style={styles.header}>
        <Text style={styles.brand}>ARTINUS OCR</Text>
        <Text style={styles.title} accessibilityRole="header">
          촬영 결과
        </Text>
        <Text style={styles.subtitle}>
          사진과 인식한 내용을 함께 확인하세요.
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isMock && (
          <View style={styles.mockNotice} testID="result-mock-notice">
            <Text style={styles.mockTitle}>개발용 모의 결과</Text>
            <Text style={styles.mockDescription}>
              모의 응답으로 화면 흐름을 확인하고 있습니다. 실제 OCR·화질 분석
              결과가 아닙니다.
            </Text>
          </View>
        )}

        <View style={styles.photoCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>촬영한 사진</Text>
            <Text style={styles.photoHint}>눌러서 확대</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="촬영한 사진 확대"
            accessibilityHint="사진을 크게 보고 확대하거나 축소할 수 있습니다."
            testID="result-enlarge-photo"
            onPress={() => setPhotoVisible(true)}
            style={({ pressed }) => [
              styles.photoButton,
              pressed && styles.pressed,
            ]}
          >
            <Image
              source={{ uri: state.photo.uri }}
              resizeMode="contain"
              testID="result-photo"
              style={styles.photo}
              accessible={false}
            />
          </Pressable>
        </View>

        {state.status === "processing" && (
          <View
            style={styles.statusCard}
            testID="result-processing"
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator size="small" color="#205E52" />
            <Text style={styles.statusTitle}>텍스트를 읽고 있어요</Text>
            <Text style={styles.statusDescription}>
              처리가 끝나면 인식한 내용이 여기에 표시됩니다. 다시 촬영하면 새
              사진으로 시작할 수 있어요.
            </Text>
          </View>
        )}

        {state.status === "error" && (
          <View
            style={styles.errorCard}
            testID="result-error"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.errorEyebrow}>인식 실패</Text>
            <Text style={styles.statusTitle}>인식하지 못했어요</Text>
            <Text style={styles.statusDescription}>
              {state.error.message.trim() ||
                "사진의 텍스트를 읽는 중 문제가 발생했습니다."}
            </Text>
            <Text style={styles.errorRecovery}>
              {canRetry
                ? "같은 사진으로 다시 시도하거나 새로 촬영해 주세요."
                : state.error.code === "CONFIGURATION" ||
                    state.error.code === "UNAUTHORIZED"
                  ? "OCR 서비스 연결 설정을 확인해 주세요."
                  : "사진을 새로 촬영해 주세요."}
            </Text>
          </View>
        )}

        {/* The recognised text comes before the quality notes: it is what the
            user opened the screen for. When nothing was read, the notes move
            inside the empty card so they read as the likely cause. */}
        {state.status === "success" && hasText && (
          <View style={styles.textCard}>
            <View style={styles.textCardHeader}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                인식한 텍스트
              </Text>
              <View style={styles.completeBadge}>
                <Text style={styles.completeText}>완료</Text>
              </View>
            </View>
            <Text
              style={styles.resultText}
              testID="result-text"
              accessibilityLiveRegion="polite"
            >
              {state.result.text}
            </Text>
          </View>
        )}

        {state.status === "success" && !hasText && (
          <View
            style={styles.emptyCard}
            testID="result-empty"
            accessibilityLiveRegion="polite"
          >
            <Text style={[styles.statusTitle, styles.leftAlign]}>
              인식한 텍스트가 없어요
            </Text>
            <Text style={[styles.statusDescription, styles.leftAlign]}>
              {warnings.length > 0
                ? "아래 항목이 원인일 수 있어요. 맞춘 뒤 다시 촬영해 주세요."
                : "글자가 잘 보이도록 거리와 초점을 조절한 뒤 다시 촬영해 주세요."}
            </Text>
            {warnings.length > 0 && (
              <View style={styles.emptyWarnings}>
                <WarningList warnings={warnings} />
              </View>
            )}
          </View>
        )}

        {state.status === "success" && hasText && warnings.length > 0 && (
          <View style={styles.warningCard} testID="result-warnings">
            <Text style={styles.warningHeading} accessibilityRole="header">
              사진 품질을 확인해 주세요
            </Text>
            <Text style={styles.warningIntro}>
              {isMock
                ? "아래 경고는 화면 확인용 예시입니다."
                : "인식한 내용을 사진과 비교하고, 빠진 글자가 있으면 다시 촬영해 주세요."}
            </Text>
            <WarningList warnings={warnings} />
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        {canRetry && (
          <Pressable
            accessibilityRole="button"
            testID="result-retry"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>다시 시도</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          testID="result-retake"
          onPress={retake}
          style={({ pressed }) => [
            canRetry ? styles.secondaryButton : styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={
              canRetry ? styles.secondaryButtonText : styles.primaryButtonText
            }
          >
            다시 촬영
          </Text>
        </Pressable>
      </View>

      {photoVisible && (
        <PhotoViewer
          photo={state.photo}
          onClose={() => setPhotoVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8F5" },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20 },
  brand: {
    color: "#54736B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.7,
    marginBottom: 9,
  },
  title: {
    color: "#172A25",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  subtitle: { color: "#65736D", fontSize: 14, lineHeight: 21, marginTop: 8 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 24, paddingBottom: 24, gap: 18 },
  mockNotice: { backgroundColor: "#EAF0FA", borderRadius: 14, padding: 16 },
  mockTitle: {
    color: "#334F79",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  mockDescription: { color: "#4B6388", fontSize: 13, lineHeight: 20 },
  photoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E9E3",
  },
  cardHeader: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#21372F",
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  photoHint: { color: "#6B7B73", fontSize: 12 },
  photoButton: { backgroundColor: "#EBEEE8", minHeight: 220 },
  photo: { width: "100%", height: 236 },
  statusCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E9E3",
    gap: 12,
  },
  statusTitle: {
    color: "#243A32",
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 27,
  },
  statusDescription: {
    color: "#66756D",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
  },
  errorCard: {
    backgroundColor: "#FFF5F2",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#F3D9D0",
    gap: 12,
  },
  errorEyebrow: {
    color: "#A34330",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  errorRecovery: {
    color: "#845C50",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
  },
  warningCard: {
    backgroundColor: "#FFF8E9",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F0E2BF",
  },
  warningHeading: {
    color: "#71531A",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
  },
  warningIntro: {
    color: "#846B3D",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 4,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 14,
  },
  warningMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F2E3BA",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  warningMarkerText: { color: "#79571D", fontSize: 13, fontWeight: "700" },
  warningText: { flex: 1 },
  warningTitle: {
    color: "#6F551F",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  warningDetail: {
    color: "#846B3D",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 3,
  },
  textCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E9E3",
  },
  textCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0EA",
  },
  completeBadge: {
    backgroundColor: "#E8F2EC",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  completeText: { color: "#36704C", fontSize: 11, fontWeight: "700" },
  resultText: { color: "#263C33", fontSize: 16, lineHeight: 27 },
  leftAlign: { textAlign: "left" },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E9E3",
    gap: 10,
  },
  emptyWarnings: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EDF0EA",
  },
  actions: {
    backgroundColor: "#F7F8F5",
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#E3E8DF",
  },
  primaryButton: {
    backgroundColor: "#205E52",
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CAD8CE",
  },
  secondaryButtonText: {
    color: "#205E52",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
  },
  pressed: { opacity: 0.72 },
});
