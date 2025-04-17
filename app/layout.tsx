import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ColorModeScript } from "./color-mode-script";
import PinPandaLogo from './components/PinPandaLogo';
import ProfileManager from './components/ProfileManager';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PinPanda - Smart Bookmark Organizer",
  description: "Organize your bookmarks intelligently with PinPanda's AI-powered categorization",
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
    ],
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased bg-white`}>
        <ColorModeScript />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}