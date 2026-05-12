import type { Metadata } from 'next';
import { cn, ThemeProvider } from '@repo/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crafty Bass Admin',
  description: 'Administrative workspace for Crafty Bass.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn('h-full antialiased font-sans')}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
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
