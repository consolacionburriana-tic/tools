import { redirect } from 'next/navigation';

// El panel del ABC vivía en /admin; ahora está en /gestion/abc detrás del login por roles.
export default function AdminRedirect() {
  redirect('/gestion/abc');
}
