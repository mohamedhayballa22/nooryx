import localFont from "next/font/local";

export const NooryxFontBlack = localFont({
  src: "./black-typeface.otf",
  display: "swap",
  variable: "--font-nooryx",
  preload: true,
});

export const NooryxFontBold = localFont({
  src: "./bold-typeface.otf",
  display: "swap",
  variable: "--font-nooryx",
  preload: true,
});
