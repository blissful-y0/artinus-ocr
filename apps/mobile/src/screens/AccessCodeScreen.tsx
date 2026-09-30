import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = { onContinue: (accessCode: string) => void };
export function AccessCodeScreen({ onContinue }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const submit = () => {
    const trimmed = code.trim();
    if (!/^[\x21-\x7e]{1,256}$/.test(trimmed)) {
      setError(true);
      return;
    }
    onContinue(trimmed);
    setCode("");
  };
  return (
    <SafeAreaView style={styles.screen} testID="remote-access-screen">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.eyebrow}>ARTINUS OCR</Text>
          <Text style={styles.title}>평가용 액세스 코드</Text>
          <Text style={styles.description}>
            전달받은 코드를 입력하면 촬영을 시작할 수 있어요. Google 계정
            비밀번호를 입력하지 마세요.
          </Text>
          <TextInput
            testID="ocr-access-code"
            accessibilityLabel="평가용 액세스 코드"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            maxLength={256}
            value={code}
            onChangeText={(value) => {
              setCode(value);
              setError(false);
            }}
            onSubmitEditing={submit}
            returnKeyType="go"
            placeholder="액세스 코드 입력"
            placeholderTextColor="#65748a"
            style={styles.input}
          />
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              전달받은 평가용 코드를 확인해 주세요.
            </Text>
          )}
          <Pressable
            testID="ocr-connect"
            accessibilityRole="button"
            onPress={submit}
            disabled={!code.trim()}
            style={[styles.button, !code.trim() && styles.disabled]}
          >
            <Text style={styles.buttonText}>촬영 시작</Text>
          </Pressable>
          <View style={styles.notice}>
            <Text style={styles.description}>
              촬영한 사진은 클라우드 OCR 서버로 전송됩니다. 코드는 이 앱 실행 중
              메모리에만 보관합니다.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f7fb" },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 28, gap: 20 },
  eyebrow: {
    color: "#315cc9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: { color: "#142139", fontSize: 27, fontWeight: "700" },
  description: { color: "#516079", fontSize: 15, lineHeight: 23 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#bdc8db",
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: "#142139",
  },
  button: {
    backgroundColor: "#315cc9",
    padding: 17,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  error: { color: "#b33737" },
  notice: { paddingTop: 8 },
});
