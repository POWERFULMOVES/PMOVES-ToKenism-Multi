import type { Metadata } from 'next';
import './globals.css';
import { SimulationProvider } from '@/lib/context/SimulationContext';
import { Toaster } from '@/components/ui/sonner';

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
    <html lang="en">
      <body>
        <SimulationProvider>{children}</SimulationProvider>
        <Toaster />
      </body>
    </html>
  );
}
