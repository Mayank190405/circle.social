import { colors, spacing } from "@circle/design-tokens";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Circle.social</Text>
      <Text>Real People. Open Conversations.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.brand, fontSize: 24, marginBottom: spacing.md },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
