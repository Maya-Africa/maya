import type { Metadata, Viewport } from 'next';
import { Inter, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/session-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Maya — The marketplace for skilled craft businesses',
  description:
    'Sell your craft, trade, or service. Secure escrow payments. Get paid in naira via Paystack. No business registration needed.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Maya',
  },
};

export const viewport: Viewport = {
  themeColor: '#1B3B5A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSerif.variable} bg-maya-background`}>
      <body className="font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
