import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "jason edman",
  description: "Jason Edman — portfolio, served as a terminal session.",
  // TEMPORARY: remove once real content replaces the placeholders.
  // Live and shareable, but kept out of search indexes so placeholder copy
  // isn't cached against a real person's name.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#080E15",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
