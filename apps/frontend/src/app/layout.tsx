import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn, ThemeProvider } from '@repo/ui';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Crafty Bass',
  description: '',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(inter.variable, 'h-full', 'antialiased', 'font-sans')}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {' '}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
