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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
