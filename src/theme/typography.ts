// Locked design system — claude.md §3a. Headings/mascot speech use Plus
// Jakarta Sans; body text uses Inter. Loaded via useAppFonts() in App.tsx.
export const fonts = {
  headingRegular: 'PlusJakartaSans_500Medium',
  headingSemiBold: 'PlusJakartaSans_600SemiBold',
  headingBold: 'PlusJakartaSans_700Bold',
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
};

// Standard type scale — added so every screen pulls sizes/weights/line
// heights from one place instead of hand-picking a fontSize per label.
// Components spread these (`...textStyles.h2`) and override color per use.
export const textStyles = {
  display: { fontFamily: fonts.headingBold, fontSize: 28, lineHeight: 34 },
  h1: { fontFamily: fonts.headingBold, fontSize: 22, lineHeight: 28 },
  h2: { fontFamily: fonts.headingSemiBold, fontSize: 18, lineHeight: 24 },
  h3: { fontFamily: fonts.headingSemiBold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: fonts.bodyRegular, fontSize: 12.5, lineHeight: 17 },
  bodySmallMedium: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 17 },
  // Uppercase section eyebrows ("TODAY'S PROGRESS", "YOUR SESSIONS") —
  // letterSpacing is part of the style so it's never forgotten per-use.
  label: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, lineHeight: 14, letterSpacing: 0.6 },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 11, lineHeight: 15 },
};
