// Genera los enlaces de acceso (magic links) de todas las familias de la campaña de
// licencias en vigor. Equivalente al botón "Generar los enlaces que falten" de
// /gestion/licencias/accesos, para poder hacerlo desde la terminal:
//
//   pnpm tokens:familias                → genera los que falten (reutiliza los vigentes)
//   pnpm tokens:familias -- --listar    → solo informa, no escribe nada
//   pnpm tokens:familias -- --dias 60   → caducidad de los nuevos (por defecto 120 días)
//
// Es idempotente: los enlaces ya enviados siguen funcionando.
import { appBaseUrl } from '@/lib/constants';
import { urlAccesoFamilia } from '@/lib/familias';
import { ensureTokens, getTokensVigentes } from '@/lib/fam-tokens-server';
import { getCurrentCampaign, getFamiliaRecipients } from '@/lib/licencias-server';

const DIAS_DEFECTO = 120;

function arg(nombre: string): string | null {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
}

async function main() {
  const soloListar = process.argv.includes('--listar');
  const dias = Number(arg('dias') ?? DIAS_DEFECTO) || DIAS_DEFECTO;

  const campaign = await getCurrentCampaign();
  if (!campaign) {
    console.error('No hay campaña de licencias. Crea una antes de generar enlaces.');
    process.exit(1);
  }
  console.log(`Campaña: ${campaign.name} (${campaign.academicYear}) · estado ${campaign.status}`);

  const { familias, alumnosObjetivo, alumnosSinCorreo, alumnosSinEnlaceCentral } = await getFamiliaRecipients(
    campaign.id,
  );
  const hijosAlcanzados = familias.reduce((n, f) => n + f.hijos.length, 0);
  console.log(
    `Alumnos activos: ${alumnosObjetivo} · familias con correo: ${familias.length} · alumnos alcanzados: ${hijosAlcanzados}`,
  );
  if (alumnosSinCorreo.length > 0) {
    console.log(`⚠️  ${alumnosSinCorreo.length} alumnos sin correo de tutor (no reciben enlace):`);
    for (const a of alumnosSinCorreo) console.log(`   · ${a.curso} — ${a.apellidos}, ${a.nombre}`);
  }
  if (alumnosSinEnlaceCentral > 0) {
    console.log(`⚠️  ${alumnosSinEnlaceCentral} alumnos sin enlace a la BBDD central (sincroniza alumnos).`);
  }

  if (soloListar) {
    const vigentes = await getTokensVigentes(
      'licencias',
      familias.map((f) => f.email),
    );
    const con = familias.filter((f) => vigentes.has(f.email)).length;
    console.log(`Enlaces vigentes: ${con} · sin enlace: ${familias.length - con} (nada escrito, modo --listar)`);
    process.exit(0);
  }

  const expiresAt = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  const tokens = await ensureTokens(familias, { proposito: 'licencias', expiresAt });
  const nuevos = [...tokens.values()].filter((t) => t.nuevo);
  console.log(
    `\n✅ ${tokens.size} familias con enlace · ${nuevos.length} nuevos · ${tokens.size - nuevos.length} reutilizados`,
  );
  console.log(`Caducidad de los nuevos: ${expiresAt.toISOString().slice(0, 10)} (${dias} días)`);

  // Muestra de control (3 enlaces) para probar a mano que funcionan. No se listan todos:
  // son credenciales de acceso, el listado completo se descarga desde el panel si hace falta.
  const base = appBaseUrl();
  console.log('\nMuestra para probar:');
  for (const f of familias.slice(0, 3)) {
    const t = tokens.get(f.email);
    if (!t) continue;
    console.log(`  ${f.email} → ${f.hijos.map((h) => h.nombre).join(', ')}`);
    console.log(`    ${urlAccesoFamilia(base, 'licencias', t.token)}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Error generando los enlaces de familias:', err);
  process.exit(1);
});
