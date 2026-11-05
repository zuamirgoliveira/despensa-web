import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BarraAbas } from "@/components/BarraAbas";
import { RegistrarSW } from "@/components/RegistrarSW";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Despensa",
  description: "Gestão da despensa e das compras da casa",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Despensa", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f6f4a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">
        <ToastProvider>
          <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-24 pt-4">{children}</main>
          <BarraAbas />
          <RegistrarSW />
        </ToastProvider>
      </body>
    </html>
  );
}
