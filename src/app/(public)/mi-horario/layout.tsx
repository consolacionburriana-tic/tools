import { PaginaModulo } from '@/components/ui/cabecera-modulo';

// La cabecera común de «Mi horario». Los guardas (sesión y permiso) van en la página, que
// es la que sabe a dónde volver tras iniciar sesión.
export default function MiHorarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <PaginaModulo modulo="mi-horario" ancho="normal">
      {children}
    </PaginaModulo>
  );
}
