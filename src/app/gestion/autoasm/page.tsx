import { EstudioAsm } from '@/components/autoasm/estudio';

export const metadata = { title: 'AUTOASM · Apple School Manager' };

// El estudio entero vive en el cliente (ver `proyecto-store.ts`): esta página solo pone
// el módulo detrás del login del layout y lo monta.
export default function AutoAsmPage() {
  return <EstudioAsm />;
}
