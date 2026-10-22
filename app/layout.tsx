import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carless — A different way to stay in Denver',
  description:
    'Explore Denver Airbnb listings alongside public transportation. Compare neighborhoods, narrow your trip, and build a personal shortlist.',
  metadataBase: new URL('http://localhost:4173'),
  openGraph: {
    title: 'Carless — Explore Denver without a car',
    description:
      'Find a stay. Follow the connections. Explore Denver listings and public transit.',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 1532,
        height: 1424,
        alt: 'Carless Denver accommodation and transit explorer',
      },
    ],
  },
  twitter: { card: 'summary_large_image', images: ['/logo.png'] },
  icons: { icon: '/logo.png' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
