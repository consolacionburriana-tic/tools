import { notFound } from 'next/navigation';
import { ARCHIVOS_ASM, ESPEC, type ArchivoAsm } from '@/lib/autoasm';
import { ExploradorAsm } from '@/components/autoasm/explorador';

export async function generateMetadata({ params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params;
  const espec = (ARCHIVOS_ASM as readonly string[]).includes(archivo) ? ESPEC[archivo as ArchivoAsm] : null;
  return { title: espec ? `${espec.titulo} · AUTOASM` : 'AUTOASM' };
}

export default async function ArchivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ archivo: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { archivo } = await params;
  if (!(ARCHIVOS_ASM as readonly string[]).includes(archivo)) notFound();
  const { q } = await searchParams;
  // La búsqueda inicial llega por la URL para que los enlaces cruzados entre ficheros
  // (un class_id que lleva a sus matrículas) funcionen sin estado compartido.
  return <ExploradorAsm archivo={archivo as ArchivoAsm} consultaInicial={q ?? ''} />;
}
