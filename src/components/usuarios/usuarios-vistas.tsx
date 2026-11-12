'use client';

import { useMemo, useState } from 'react';
import { UserRound, UsersRound } from 'lucide-react';
import { Segmentado } from '@/components/ui/segmentado';
import { RolesGrid, type FilaUsuario } from '@/components/usuarios/roles-grid';
import { GruposPanel, type GrupoVista } from '@/components/usuarios/grupos-panel';

type Vista = 'personas' | 'grupos';

// Usuarios y roles en dos vistas que comparten estado: lo que se toca en un grupo se ve al
// momento en la fila de cada persona (sus módulos «de un grupo»), sin recargar.
export function UsuariosVistas({
  filas,
  grupos: gruposIniciales,
  miEmail,
  puedeEmular,
}: {
  filas: FilaUsuario[];
  grupos: GrupoVista[];
  miEmail: string;
  puedeEmular: boolean;
}) {
  const [vista, setVista] = useState<Vista>('personas');
  const [datos, setDatos] = useState(filas);
  const [grupos, setGrupos] = useState(gruposIniciales);

  // A un grupo se puede meter a cualquiera con acceso (no a quien está bloqueado).
  const personas = useMemo(
    () =>
      datos
        .filter((f) => !f.bloqueado)
        .map((f) => ({ email: f.email.toLowerCase(), nombre: f.nombre }))
        .sort((a, b) => (a.nombre ?? a.email).localeCompare(b.nombre ?? b.email, 'es')),
    [datos],
  );

  return (
    <div className="space-y-4">
      <Segmentado
        etiqueta="Ver"
        valor={vista}
        onChange={setVista}
        opciones={[
          { valor: 'personas', etiqueta: 'Personas', icono: <UserRound aria-hidden />, cuenta: datos.length },
          { valor: 'grupos', etiqueta: 'Grupos', icono: <UsersRound aria-hidden />, cuenta: grupos.length },
        ]}
      />
      {vista === 'personas' ? (
        <RolesGrid datos={datos} setDatos={setDatos} grupos={grupos} miEmail={miEmail} puedeEmular={puedeEmular} />
      ) : (
        <GruposPanel grupos={grupos} setGrupos={setGrupos} personas={personas} />
      )}
    </div>
  );
}
