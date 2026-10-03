import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        {children}
        {/* The script is served by Vercel only; elsewhere it would 404. */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
