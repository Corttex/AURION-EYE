import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AURION — Rede MAIN | Centro de Comando',
  description: 'Centro de Comando Operacional do Ecossistema AURION',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-obsidian-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
