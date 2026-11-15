import type { Metadata } from 'next';
import { Assistant, Frank_Ruhl_Libre } from 'next/font/google';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

const sans = Assistant({ subsets: ['hebrew', 'latin'], weight: ['400', '600', '700', '800'], variable: '--font-sans' });
const display = Frank_Ruhl_Libre({ subsets: ['hebrew', 'latin'], weight: ['500', '700', '900'], variable: '--font-display' });

export const metadata: Metadata = { title: 'סורק משרות', description: 'משרות שיווק מותאמות עם חידודים לקורות החיים' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
