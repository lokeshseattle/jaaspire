import React, {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
} from "react";
import { Animated, StyleSheet, Text, TextStyle, ViewStyle } from "react-native";

type Variant = "success" | "error" | "info" | "warning";

type ToastContextType = {
  trigger: (message: string, variant?: Variant) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(false);

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

  const containerStyle = [
    styles.container,
    variantStyles[variant].container,
  ] as ViewStyle[];

  const textStyle = [styles.text, variantStyles[variant].text] as TextStyle[];

  return (
    <ToastContext.Provider value={{ trigger }}>
      {children}

      <Animated.View
        pointerEvents="none"
        style={[
          containerStyle,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={textStyle}>{message}</Text>
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
  container: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    elevation: 8,
  },
  text: {
    fontWeight: "600",
  },
});

const variantStyles = {
  success: {
    container: { backgroundColor: "#22c55e" },
    text: { color: "white" },
  },
  error: {
    container: { backgroundColor: "#ef4444" },
    text: { color: "white" },
  },
  info: {
    container: { backgroundColor: "#3b82f6" },
    text: { color: "white" },
  },
  warning: {
    container: { backgroundColor: "#f59e0b" },
    text: { color: "white" },
  },
};
