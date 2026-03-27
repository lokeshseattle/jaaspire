import { useTheme } from '@/src/theme/ThemeProvider';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const { theme } = useTheme();
  const baseColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const hasExplicitTint = lightColor != null || darkColor != null;
  const typeColor = hasExplicitTint
    ? baseColor
    : type === 'link'
      ? theme.colors.primary
      : type === 'subtitle'
        ? theme.colors.textSecondary
        : baseColor;

  return (
    <Text
      style={[
        { color: typeColor },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.linkBase : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  linkBase: {
    lineHeight: 30,
    fontSize: 16,
  },
});
