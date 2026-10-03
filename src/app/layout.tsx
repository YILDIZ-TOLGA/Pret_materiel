import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/AppShell";
import { DialogProvider } from "@/components/Dialog";
import { Providers } from "@/components/Providers";
import { ToastProvider } from "@/components/Toast";
import { Tracker } from "@/components/Tracker";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Prêt Matériel",
  description: "Suis tes prêts d'objets et d'argent. Les relances partent automatiquement.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Prêt Matériel", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f0ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0e100f" },
  ],
};

// Applique le thème choisi (clair/sombre) avant le premier affichage, pour éviter un flash.
const THEME = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>
        <Providers>
          <ToastProvider>
            <DialogProvider>
              <AppFrame>{children}</AppFrame>
            </DialogProvider>
          </ToastProvider>
          <Tracker />
        </Providers>
      </body>
    </html>
  );
}
