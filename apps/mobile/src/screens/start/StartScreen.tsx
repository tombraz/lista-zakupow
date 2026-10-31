import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme";
import { messages } from "./messages";
import { useApiStatus } from "./useApiStatus";

export function StartScreen() {
  const { data: status } = useApiStatus();
  const text = status ? messages.status[status] : messages.checking;

  return (
    <SafeAreaView style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {messages.title}
      </Text>
      <Text
        accessibilityRole="text"
        accessibilityLabel={`${messages.statusLabel}: ${text}`}
        accessibilityLiveRegion="polite"
        style={styles.status}
      >
        {text}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bgDefault,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.md,
    color: theme.color.textPrimary,
    fontSize: theme.font.titleLg,
    lineHeight: theme.lineHeight.titleLg,
    fontWeight: theme.font.weightBold,
  },
  status: {
    color: theme.color.textSecondary,
    fontSize: theme.font.body,
    lineHeight: theme.lineHeight.body,
  },
});
