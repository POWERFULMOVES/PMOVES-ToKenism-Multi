import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PMOVES Economic Simulator',
  description: 'Compare traditional economic systems with cooperative community-based models',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --background: 240 10% 4%;
            --foreground: 190 20% 90%;
            --card: 240 8% 7%;
            --card-foreground: 190 20% 90%;
            --popover: 240 8% 7%;
            --popover-foreground: 190 20% 90%;
            --primary: 190 80% 50%;
            --primary-foreground: 240 10% 4%;
            --secondary: 240 6% 14%;
            --secondary-foreground: 190 20% 90%;
            --muted: 240 6% 12%;
            --muted-foreground: 240 5% 45%;
            --accent: 35 90% 55%;
            --accent-foreground: 240 10% 4%;
            --destructive: 0 70% 45%;
            --destructive-foreground: 190 20% 90%;
            --border: 240 6% 16%;
            --input: 240 6% 16%;
            --ring: 190 80% 50%;
            --positive: 152 70% 50%;
            --positive-muted: 161 60% 14%;
            --informative: 190 90% 55%;
            --informative-muted: 200 40% 14%;
            --accent-strong: 25 90% 55%;
            --accent-muted: 30 50% 14%;
            --radius: 0.5rem;
          }
        `}} />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          <ErrorBoundaryWrapper
            onError={(error, errorInfo) => {
              // Log errors for monitoring
              console.error('Layout Error Boundary:', error, errorInfo);
            }}
          >
            <AppShell>{children}</AppShell>
            <Toaster />
          </ErrorBoundaryWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
