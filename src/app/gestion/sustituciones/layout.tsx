import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { PaginaModulo } from '@/components/ui/cabecera-modulo';
import { puedeGestionarSustituciones } from '@/lib/sustituciones-diarias';
export default async function SustitucionesLayout({children}:{children:React.ReactNode}) { const user=await getSessionUser(); if(!user) redirect('/gestion/login'); if(!puedeGestionarSustituciones(user.role)||!canAccess(user,'sustituciones')) redirect('/gestion/sin-acceso'); return <PaginaModulo modulo="sustituciones" ancho="ancho">{children}</PaginaModulo>; }
