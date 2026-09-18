import { StyleSheet } from 'react-native';

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
};

export const Typography = StyleSheet.create({
  h1: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, letterSpacing: -0.5 },
  h2: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold },
  h3: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  h4: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  body: { fontSize: FontSize.base, fontWeight: FontWeight.regular },
  bodyMedium: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  caption: { fontSize: FontSize.sm, fontWeight: FontWeight.regular },
  captionMedium: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },
});
