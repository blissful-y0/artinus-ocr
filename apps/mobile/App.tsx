import { Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: 24 }}>
          <Text>ARTINUS OCR</Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
