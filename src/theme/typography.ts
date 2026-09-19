import { StyleSheet, Platform } from 'react-native';

export const FontFamily = {
  // Headings & Display Numbers (Outfit)
  displayRegular: 'Outfit_400Regular',
  displayMedium: 'Outfit_500Medium',
  displaySemiBold: 'Outfit_600SemiBold',
  displayBold: 'Outfit_700Bold',
  displayExtraBold: 'Outfit_800ExtraBold',
  displayBlack: 'Outfit_900Black',

  // Body & UI (Plus Jakarta Sans)
  sansRegular: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansExtraBold: 'PlusJakartaSans_800ExtraBold',
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
  '5xl': 40,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

export const LineHeight = {
  tight: 1.15,
  normal: 1.45,
  relaxed: 1.65,
};

export const Typography = StyleSheet.create({
  hero: {
    fontFamily: FontFamily.displayBlack,
    fontSize: FontSize['4xl'],
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  h1: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['3xl'],
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: FontSize.xl,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  h4: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  body: {
    fontFamily: FontFamily.sansRegular,
    fontSize: FontSize.base,
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  bodySemiBold: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  caption: {
    fontFamily: FontFamily.sansRegular,
    fontSize: FontSize.sm,
    fontWeight: '400',
  },
  captionMedium: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  label: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

