import type { Metadata, Viewport } from "next";
import { Inter, Michroma } from "next/font/google";
import { BarraAbas } from "@/components/BarraAbas";
import { Cabecalho } from "@/components/Cabecalho";
import { RegistrarSW } from "@/components/RegistrarSW";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const michroma = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-michroma" });

export const metadata: Metadata = {
  title: "Despensa",
  description: "Gestão da despensa e das compras da casa",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Despensa", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b1a3d" },
    { media: "(prefers-color-scheme: dark)", color: "#060f26" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: public/theme-init.js define data-tema em <html> antes da hidratação.
    <html lang="pt-BR" className={`${inter.variable} ${michroma.variable}`} suppressHydrationWarning>
      <head>
        {/* Síncrono de propósito: aplica o tema antes da primeira pintura (evita flash). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body>
        <ToastProvider>
          <div className="mx-auto min-h-dvh w-full max-w-coluna bg-fundo sm:border-x sm:border-borda">
            <Cabecalho />
            <main className="px-4 pb-28 pt-4">{children}</main>
          </div>
          <BarraAbas />
          <RegistrarSW />
        </ToastProvider>
      </body>
    </html>
  );
}
