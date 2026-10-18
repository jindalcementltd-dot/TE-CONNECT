import { StyleSheet, Platform } from 'react-native';

export const FontFamily = {
  // Headings & Display Numbers (Oswald)
  displayRegular: 'Sen_400Regular',
  displayMedium: 'Sen_500Medium',
  displaySemiBold: 'Sen_600SemiBold',
  displayBold: 'Sen_700Bold',
  displayExtraBold: 'Sen_700Bold', // Oswald doesn't have 800/900 in the basic package
  displayBlack: 'Sen_700Bold',

  // Body & UI (Poppins)
  sansRegular: 'Poppins_400Regular',
  sansMedium: 'Poppins_500Medium',
  sansSemiBold: 'Poppins_600SemiBold',
  sansBold: 'Poppins_700Bold',
  sansExtraBold: 'Poppins_700Bold',
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
    letterSpacing: -0.8,
  },
  h1: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['3xl'],
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['2xl'],
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: FontSize.xl,
    letterSpacing: -0.2,
  },
  h4: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: FontSize.lg,
  },
  body: {
    fontFamily: FontFamily.sansRegular,
    fontSize: FontSize.base,
  },
  bodyMedium: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.base,
  },
  bodySemiBold: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.base,
  },
  caption: {
    fontFamily: FontFamily.sansRegular,
    fontSize: FontSize.sm,
  },
  captionMedium: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
  label: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xs,
    letterSpacing: 0.6,
  },
});

