import { Escaparate } from '@/components/diseno/escaparate';

export const metadata = { title: 'Piezas de diseño · Tools Consolación' };

export default function Page() {
  return (
    <>
      <h1 className="sr-only">Piezas de diseño</h1>
      <Escaparate />
    </>
  );
}
