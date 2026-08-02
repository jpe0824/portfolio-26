import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { TerminalFrame } from "@/components/terminal-frame";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves relative URLs in any generated metadata (canonical, Open Graph) against
  // the custom domain rather than whatever host served the request — otherwise the
  // *.vercel.app alias advertises itself as canonical for the same content.
  metadataBase: new URL(SITE_URL),
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
    <html lang="en" className={`${jetbrainsMono.variable} no-js`} suppressHydrationWarning>
      <body>
        {/* Removed during parse, before the frame paints, so JS-only controls never
            flash. With JS off the class stays and .js-only stays hidden — the
            terminal is absent rather than present and dead. suppressHydrationWarning above
            is confined to this element's own attributes (React does not propagate it to
            children): the inline script always desyncs `className` from what the server
            sent, by design, so this is the standard next-themes-style mitigation for that
            one, expected attribute — not a blanket waiver on this subtree. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.remove('no-js')" }} />
        <TerminalFrame explorer={explorer}>{children}</TerminalFrame>
      </body>
    </html>
  );
}
