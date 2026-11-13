import { listaProfes, historial, totales } from '@/lib/sustituciones-guardias-server';
import { PanelSustituciones } from '@/components/sustituciones/panel';
export const dynamic='force-dynamic';
export const metadata={title:'Sustituciones · Gestión'};
export default async function Page(){const [profes,registros,cifras]=await Promise.all([listaProfes(),historial(),totales()]);return <><h1 className="sr-only">Sustituciones</h1><PanelSustituciones profes={profes} registros={registros} cifras={cifras}/></>}
