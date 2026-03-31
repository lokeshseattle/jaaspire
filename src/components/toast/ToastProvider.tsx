import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Core tab row height; safe area (home indicator) is added via insets. */
const TAB_BAR_BASE_HEIGHT = Platform.OS === "ios" ? 49 : 56;
const GAP_ABOVE_TAB_BAR = 6;

type Variant = "success" | "error" | "info" | "warning";

type ToastContextType = {
  trigger: (message: string, variant?: Variant) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(false);

  const bottomOffset =
    TAB_BAR_BASE_HEIGHT + insets.bottom + GAP_ABOVE_TAB_BAR;

  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<Variant>("info");

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isVisibleRef.current = true;
    });
  };

  const animateOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isVisibleRef.current = false;
      callback?.();
    });
  };

  const trigger = useCallback((msg: string, v: Variant = "info") => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const show = () => {
      setMessage(msg);
      setVariant(v);
      animateIn();

      timeoutRef.current = setTimeout(() => {
        animateOut();
      }, 3000);
    };

    if (isVisibleRef.current) {
      animateOut(show);
    } else {
      show();
    }
  }, []);

  const bubbleStyle = [
    styles.bubble,
    variantStyles[variant].container,
  ] as ViewStyle[];

  const textStyle = [styles.text, variantStyles[variant].text] as TextStyle[];

  return (
    <ToastContext.Provider value={{ trigger }}>
      {children}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.anchor,
          {
            bottom: bottomOffset,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={bubbleStyle}>
          <Text style={textStyle}>{message}</Text>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  bubble: {
    maxWidth: "88%",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(28, 28, 30, 0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  text: {
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 17,
    color: "rgba(255, 255, 255, 0.88)",
    textAlign: "center",
  },
});

/** Variant only nudges a slim accent — shared glass surface keeps UI calm. */
const variantStyles: Record<
  Variant,
  { container: ViewStyle; text: TextStyle }
> = {
  success: {
    container: { borderLeftWidth: 2, borderLeftColor: "rgba(134, 239, 172, 0.55)" },
    text: {},
  },
  error: {
    container: { borderLeftWidth: 2, borderLeftColor: "rgba(252, 165, 165, 0.5)" },
    text: {},
  },
  info: {
    container: { borderLeftWidth: 2, borderLeftColor: "rgba(186, 186, 190, 0.45)" },
    text: {},
  },
  warning: {
    container: { borderLeftWidth: 2, borderLeftColor: "rgba(253, 224, 71, 0.45)" },
    text: {},
  },
};
