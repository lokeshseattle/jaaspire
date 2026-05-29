import JaasiStar from "@/assets/svg/JaasiStar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

type PostPaywallProps = {
  price: number;
  isExclusive: boolean;
  onPay: () => void;
};

export function PostPaywall({ price, isExclusive, onPay }: PostPaywallProps) {
  const subtitle = isExclusive
    ? "Subscribe for access"
    : "Unlock this content to continue";

  return (
    <LinearGradient colors={["#1a1040", "#0f0d2b"]} style={styles.wrapper}>
      <View style={styles.content}>
        <Ionicons name="lock-closed" size={28} color="#fff" />
        <Text style={styles.title}>Exclusive Content</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {price > 0 && (
          <View style={styles.priceRow}>
            <JaasiStar width={18} height={18} />
            <Text style={styles.price}>{price} Jaasi Stars</Text>
          </View>
        )}
        <Pressable style={styles.button} onPress={onPay}>
          <Text style={styles.buttonText}>Unlock Now</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    minHeight: 360,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  price: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
