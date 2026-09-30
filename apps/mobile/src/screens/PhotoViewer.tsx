import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import type { ScanPhoto } from "../features/scan/types";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const FALLBACK_RATIO = 3 / 4;

type Props = { photo: ScanPhoto; onClose: () => void };

export function PhotoViewer({ photo, onClose }: Props) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const photoRatio =
    photo.width > 0 && photo.height > 0
      ? photo.width / photo.height
      : FALLBACK_RATIO;
  const fittedWidth = Math.min(viewport.width, viewport.height * photoRatio);
  const fittedHeight = fittedWidth / photoRatio;
  const imageWidth = fittedWidth * zoom;
  const imageHeight = fittedHeight * zoom;

  function updateViewport(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width: Math.max(1, width), height: Math.max(1, height) });
  }

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaProvider style={styles.viewer}>
        <SafeAreaView
          style={styles.viewer}
          testID="result-photo-modal"
          accessibilityViewIsModal
        >
          <StatusBar style="light" />
          <View style={styles.viewerHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="확대한 사진 닫기"
              testID="result-close-photo"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.viewerButtonPressed,
              ]}
            >
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
            <View style={styles.viewerHeading}>
              <Text style={styles.viewerTitle}>촬영한 사진</Text>
              <Text style={styles.viewerHint}>
                {zoom > MIN_ZOOM
                  ? "드래그해서 사진을 둘러보세요"
                  : "확대해서 글자를 확인하세요"}
              </Text>
            </View>
          </View>

          <View style={styles.viewerViewport} onLayout={updateViewport}>
            {viewport.width > 0 && viewport.height > 0 && (
              <ScrollView
                horizontal
                bounces={false}
                automaticallyAdjustContentInsets={false}
                contentInsetAdjustmentBehavior="never"
                scrollEnabled={zoom > MIN_ZOOM}
                showsHorizontalScrollIndicator={zoom > MIN_ZOOM}
                indicatorStyle="white"
                style={styles.horizontalPhotoScroll}
                contentContainerStyle={{ minWidth: viewport.width }}
              >
                <ScrollView
                  bounces={false}
                  automaticallyAdjustContentInsets={false}
                  contentInsetAdjustmentBehavior="never"
                  nestedScrollEnabled
                  scrollEnabled={zoom > MIN_ZOOM}
                  showsVerticalScrollIndicator={zoom > MIN_ZOOM}
                  indicatorStyle="white"
                  style={{
                    width: Math.max(viewport.width, imageWidth),
                    height: viewport.height,
                  }}
                  contentContainerStyle={[
                    styles.verticalPhotoContent,
                    { minHeight: viewport.height },
                  ]}
                >
                  <Image
                    key={`${photo.uri}:${imageWidth}:${imageHeight}`}
                    source={{ uri: photo.uri }}
                    testID="result-photo-expanded"
                    resizeMode="contain"
                    accessible
                    accessibilityLabel={`촬영한 사진, ${zoom}배 확대`}
                    style={{ width: imageWidth, height: imageHeight }}
                  />
                </ScrollView>
              </ScrollView>
            )}
          </View>

          <View style={styles.zoomToolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 축소"
              accessibilityState={{ disabled: zoom === MIN_ZOOM }}
              disabled={zoom === MIN_ZOOM}
              testID="result-zoom-out"
              onPress={() => setZoom((value) => Math.max(MIN_ZOOM, value - 1))}
              style={({ pressed }) => [
                styles.zoomButton,
                zoom === MIN_ZOOM && styles.viewerButtonDisabled,
                pressed && styles.viewerButtonPressed,
              ]}
            >
              <Text style={styles.zoomButtonText}>−</Text>
            </Pressable>
            <Text style={styles.zoomValue} accessibilityLiveRegion="polite">
              {zoom}×
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 확대"
              accessibilityState={{ disabled: zoom === MAX_ZOOM }}
              disabled={zoom === MAX_ZOOM}
              testID="result-zoom-in"
              onPress={() => setZoom((value) => Math.min(MAX_ZOOM, value + 1))}
              style={({ pressed }) => [
                styles.zoomButton,
                zoom === MAX_ZOOM && styles.viewerButtonDisabled,
                pressed && styles.viewerButtonPressed,
              ]}
            >
              <Text style={styles.zoomButtonText}>＋</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, minHeight: 0, minWidth: 0, backgroundColor: "#101A17" },
  viewerHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexShrink: 0,
  },
  viewerHeading: { flex: 1 },
  viewerTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  viewerHint: { color: "#B3C1B9", fontSize: 12, lineHeight: 19, marginTop: 6 },
  closeButton: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    minHeight: 48,
    backgroundColor: "#27372F",
    borderRadius: 12,
    justifyContent: "center",
  },
  closeText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  viewerViewport: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" },
  horizontalPhotoScroll: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  verticalPhotoContent: { alignItems: "center", justifyContent: "center" },
  zoomToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingTop: 18,
    paddingBottom: 20,
    flexShrink: 0,
  },
  zoomButton: {
    width: 52,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27372F",
    borderRadius: 14,
  },
  zoomButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600",
  },
  zoomValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    minWidth: 32,
    textAlign: "center",
  },
  viewerButtonDisabled: { opacity: 0.35 },
  viewerButtonPressed: { opacity: 0.7 },
});
