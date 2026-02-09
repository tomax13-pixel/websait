import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PWAScript } from "@/components/PWAScript";
import { AuthProvider } from "@/providers/AuthProvider";
import { BottomNav } from "@/components/BottomNav";
import { NotificationManager } from "@/components/NotificationManager";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "サークル結 (Circle Knot)",
  description: "サークル出欠・集金管理アプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "サークル結",
  },
};

export const viewport: Viewport = {
  themeColor: "#BF1E2C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-gray-50 text-gray-900 pb-20`}>
        <AuthProvider>
          <PWAScript />
          <NotificationManager />
          <main className="max-w-md mx-auto min-h-screen bg-white shadow-sm">
            {children}
          </main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
