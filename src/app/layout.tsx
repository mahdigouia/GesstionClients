import type {Metadata} from 'next';
import './globals.css';
import { DebtProvider } from '@/lib/DebtContext';

export const metadata: Metadata = {
  title: 'GesstionClients - Analyse des Créances',
  description: 'Application d\'analyse et de gestion des créances clients',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
              </head>
      <body className="font-body antialiased">
        <DebtProvider>{children}</DebtProvider>
      </body>
    </html>
  );
}
