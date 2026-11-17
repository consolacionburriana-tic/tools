'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ConfirmarSustitucion({ token }: { token: string }) {
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'confirmada' | 'ya_confirmada' | 'no_encontrada'>('inicial');
  async function confirmar() {
    setEstado('enviando');
    try {
      const r = await fetch(`/api/sustituciones/confirmar/${token}`, { method: 'POST' });
      const data = await r.json();
      setEstado(data.estado);
    } catch {
      setEstado('no_encontrada');
    }
  }
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-5 px-5">
    <h1 className="text-2xl font-semibold">Confirmar sustitución</h1>
    {estado === 'inicial' || estado === 'enviando' ? <><p>Al confirmar, Jefatura sabrá que has recibido el aviso y puedes hacerte cargo de la sustitución.</p><Button onClick={() => void confirmar()} cargando={estado === 'enviando'}>Confirmar sustitución</Button></> : null}
    {estado === 'confirmada' && <p role="status">Sustitución confirmada. Gracias.</p>}
    {estado === 'ya_confirmada' && <p role="status">Esta sustitución ya estaba confirmada. Gracias.</p>}
    {estado === 'no_encontrada' && <p role="alert">El enlace no es válido o ya no está activo. Contacta con Jefatura.</p>}
  </main>;
}
