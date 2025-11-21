import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Providers } from "./providers";
import TopLoadingBar from "./top-loading-bar";
import { RootProvider } from "fumadocs-ui/provider/next";

export const metadata: Metadata = {
  title: "Nooryx",
  description: "Inventory management made easy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <TopLoadingBar />
            <RootProvider
              search={{
                options: {
                  type: 'static',
                  api: '/docs-search',
                },
              }}
            >
              {children}
            </RootProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
