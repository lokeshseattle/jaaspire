import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

const FLICKS_CANVAS = "#000";
const FLICK_TEXT_MUTED = "rgba(255,255,255,0.72)";

type ErrorBoundaryState = { hasError: boolean };

type FlickItemErrorBoundaryProps = {
  postId: number;
  width: number;
  height: number;
  children: ReactNode;
};

export default class FlickItemErrorBoundary extends Component<
  FlickItemErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: FlickItemErrorBoundaryProps) {
    if (prevProps.postId !== this.props.postId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* optional logging */
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={[
            styles.fallback,
            { width: this.props.width, height: this.props.height },
          ]}
        >
          <Text style={styles.fallbackText}>Couldn't load this flick</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: FLICKS_CANVAS,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: FLICK_TEXT_MUTED,
    fontSize: 14,
  },
});
