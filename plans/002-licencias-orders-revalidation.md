# Plan 002: Revalidar el identificador familiar en `/api/licencias/orders` (IDOR: hoy basta un studentId)

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If anything
> in the "STOP conditions" section occurs, stop and report — do not improvise. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fd75980..HEAD -- src/app/api/licencias/orders/ src/components/licencias/licencias-form.tsx`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (toca el flujo público de pedidos de la campaña activa)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `fd75980`, 2026-08-05

## Why this matters

La convención del repo para flujos públicos sin sesión es explícita
(`docs/04-convenciones-tecnicas.md`): *"En cada petición posterior del flujo se revalida
el identificador contra el alumno (los flujos públicos no tienen sesión)"*. Salidas lo
cumple (`src/app/api/salidas/estado/route.ts` llama a `verifyFamilyStudent` en cada
petición). Licencias NO: `/api/licencias/orders` acepta un `studentId` a pelo.

- **GET** `?studentId=<uuid>` devuelve el pedido existente **incluyendo el email del
  tutor** (dato personal) y los códigos de libros.
- **POST** `{ studentId, curso, email, cods }` crea o **sobreescribe** el pedido de ese
  alumno y cambia el email de confirmación, sin probar que quien llama es su familia.

Un tercero que conozca u obtenga un UUID de `lic_students` puede leer el email de una
familia y modificar su pedido. El fix: exigir `identificador` (DNI/NIA/token) y
revalidarlo en servidor, como hace Salidas.

## Current state

- `src/app/api/licencias/orders/route.ts` — GET (líneas 14-34) y POST (36-55+). Extracto del GET:

```ts
export async function GET(request: Request) {
  try {
    const studentId = new URL(request.url).searchParams.get('studentId');
    if (!studentId) return NextResponse.json({ error: 'Falta studentId' }, { status: 400 });
    const campaign = await getCurrentCampaign();
    if (!campaign) return NextResponse.json({ order: null });
    const existing = await getOrderForStudent(campaign.id, studentId);
```

  Extracto del POST:

```ts
    const { studentId, curso, email, cods } = (await request.json()) as { ... };
    if (!studentId || !curso) { ... 400 ... }
    const student = await getStudentById(studentId);
    if (!student) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });
    const result = await upsertOrder(student, curso, cleanEmail, Array.isArray(cods) ? cods : []);
```

  Nota: el POST tampoco valida el body con Zod (la convención del repo exige Zod en
  todo payload de red).

- **La función de revalidación ya existe**: `src/lib/licencias-server.ts:46`
  `identifyStudentsByFamily(campaignId, identificador)` — resuelve el identificador
  (DNI tutor / NIA / token, vía `identifyFamily` de `familias-server`) y devuelve los
  alumnos `lic_students` de esa familia con su `id`. Revalidar = comprobar que el
  `studentId` recibido está entre los `id` devueltos.

- **El cliente ya tiene el identificador**: `src/components/licencias/licencias-form.tsx`
  guarda lo tecleado/el token en su estado (paso `identify`, el input se manda a
  `/api/licencias/identify` como `{ identificador }`). Hay que pasarlo también a las
  llamadas a `/api/licencias/orders` (GET y POST).

- Ejemplar del patrón correcto — `src/app/api/salidas/estado/route.ts`:

```ts
const hijo = await verifyFamilyStudent(identificador, eduStudentId);
if (!hijo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Lint | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |
| Dev | `pnpm dev` | server en :3000 |

## Scope

**In scope**:
- `src/app/api/licencias/orders/route.ts`
- `src/components/licencias/licencias-form.tsx` (añadir `identificador` a los fetch de orders)

**Out of scope**:
- `src/lib/licencias-server.ts` — no cambiar `upsertOrder`/`identifyStudentsByFamily`; solo consumirlas.
- `/api/licencias/identify` y `/api/licencias/catalog` — identify ya es seguro (devuelve solo nombres enmascarados); catalog no expone datos personales. No tocar.
- Las rutas `admin/*` de licencias — ya van con `requireModule`.

## Git workflow

- Branch: `fix/licencias-orders-idor`; mensaje tipo `fix(licencias): revalidar identificador en /api/licencias/orders`.

## Steps

### Step 1: Añadir schema Zod y revalidación al POST

En `src/app/api/licencias/orders/route.ts`:

1. `import { z } from 'zod';` e `import { identifyStudentsByFamily } from '@/lib/licencias-server';` (añadir al import existente).
2. Define el schema del body:

```ts
const orderSchema = z.object({
  identificador: z.string().min(3),
  studentId: z.string().uuid(),
  curso: z.string().min(1),
  email: z.string().email().or(z.literal('')).optional(),
  cods: z.array(z.string()).default([]),
});
```

3. En el POST, sustituye el cast `as { ... }` por `orderSchema.parse(await request.json())`
   (400 con mensaje genérico si lanza — el catch existente ya devuelve error).
4. Tras obtener `campaign` (usa `getCurrentCampaign()`, ya importado en el fichero para el GET;
   si el POST no la carga hoy, cárgala), revalida ANTES de `getStudentById`:

```ts
const candidatos = await identifyStudentsByFamily(campaign.id, identificador);
if (!candidatos.some((c) => c.id === studentId)) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
}
```

**Verify**: `pnpm build` → exit 0.

### Step 2: Misma revalidación en el GET

Lee `identificador` de query (`searchParams.get('identificador')`); si falta → 400.
Aplica el mismo bloque de `identifyStudentsByFamily` + `403` antes de `getOrderForStudent`.

**Verify**: `pnpm build` → exit 0.

### Step 3: Pasar el identificador desde el formulario

En `src/components/licencias/licencias-form.tsx` localiza los fetch a
`/api/licencias/orders` (hay un GET de precarga y un POST de confirmación; búscalos con
`grep -n "licencias/orders" src/components/licencias/licencias-form.tsx`). El componente
guarda el valor tecleado en el paso identify (estado del input; si entró por magic link,
`tokenAcceso`). Usa como identificador el mismo string que se envió a
`/api/licencias/identify` (guárdalo en un estado `identificadorUsado` en el momento del
identify si no existe ya) y añádelo: al GET como query param, al POST en el body.

**Verify**: `pnpm build` → exit 0.

### Step 4: Prueba manual del flujo completo

Con `pnpm dev` y datos de dev:

1. Flujo feliz: identificarse con un NIA/DNI de dev → elegir libros → confirmar. El
   pedido se guarda (pantalla "¡Solicitud registrada!").
2. Ataque simulado:

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/licencias/orders?studentId=<uuid-válido-de-dev>&identificador=99999999"
```

**Verify**: paso 1 funciona igual que antes; paso 2 imprime `403` (y sin identificador, `400`).

## Test plan

Sin runner aún (plan 004). Si 004 ya está ejecutado: añade a `src/lib/__tests__/` un test
del schema Zod (payloads válidos/ inválidos) — la revalidación en sí es de integración y
queda cubierta por el curl del Step 4.

## Done criteria

- [ ] `grep -n "identifyStudentsByFamily" src/app/api/licencias/orders/route.ts` → 2 usos (GET y POST)
- [ ] `grep -n "orderSchema" src/app/api/licencias/orders/route.ts` → schema definido y usado
- [ ] `pnpm lint` y `pnpm build` exit 0
- [ ] curl con identificador ajeno → 403; flujo real de familia → funciona
- [ ] `plans/README.md` actualizado

## STOP conditions

- Si `identifyStudentsByFamily` no existe o cambió de firma → STOP (el plan está desfasado).
- Si el formulario NO conserva el identificador tras el paso identify y el cambio exige
  reestructurar el wizard más allá de añadir un estado → STOP y reporta.
- Si hay una campaña REAL abierta en producción y no puedes probar en dev → STOP antes de
  desplegar; este cambio necesita la prueba manual del Step 4.

## Maintenance notes

- Cualquier endpoint público futuro que reciba un id de alumno debe revalidar contra el
  identificador (patrón `verifyFamilyStudent` / `identifyStudentsByFamily`).
- Revisor: mirar que el email del tutor ya no sea legible sin identificador válido, y que
  el mensaje de error sea genérico (nunca confirmar si un DNI existe).
- Seguimiento deferido: la portada (`src/app/page.tsx`) tiene dos CTAs que apuntan ambos a
  `/licencias` ("Solicitar" y "¿He hecho mi pedido?"); un flujo real de consulta de pedido
  podría apoyarse en esta misma revalidación. Decisión de David (apuntado en plans/README).
