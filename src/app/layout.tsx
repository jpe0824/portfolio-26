import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { TerminalFrame } from "@/components/terminal-frame";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "jason edman",
  description: "Jason Edman, senior software engineer.",
};

export const viewport: Viewport = {
  themeColor: "#080E15",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
  explorer,
}: {
  children: React.ReactNode;
  explorer: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} no-js`}>
      <body>
        {/* Removed during parse, before the frame paints, so JS-only controls never
            flash. With JS off the class stays and .js-only stays hidden — the
            terminal is absent rather than present and dead. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.remove('no-js')" }} />
        <TerminalFrame explorer={explorer}>{children}</TerminalFrame>
      </body>
    </html>
  );
}
