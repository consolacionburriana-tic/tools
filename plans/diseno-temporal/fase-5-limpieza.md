# Fase 5 · Limpieza

> TEMPORAL: es el plan que borra esta carpeta.
> **Estado: BORRADOR.** Al final de todo (o antes, si David decide parar aquí).

## Pasos

1. Comprobar que lo permanente está en su sitio:
   - [ ] `docs/diseno.md` existe, tiene las decisiones finales y está enlazada desde `AGENTS.md`,
         `docs/04-convenciones-tecnicas.md` (§UI) y `docs/plataforma.md`.
   - [ ] `/gestion/diseno` (escaparate) y `pnpm diseno:guardia` funcionan.
   - [ ] Los arreglos de `arreglos-sueltos.md` están hechos, o pasados a `docs/pequeños-arreglos.md`.
   - [ ] Lo que haya quedado sin hacer de las fases 1-4 está apuntado en
         `docs/00-desarrollos-futuros.md` (no se pierde con la carpeta).
2. Borrar la carpeta:
   ```bash
   git rm -r plans/diseno-temporal
   git commit -m "Diseño: fuera los planes temporales (la guía vive en docs/diseno.md)"
   ```
3. **Pedir permiso a David** y borrar el artefacto «Diseño de Tools Consolación»
   (<https://claude.ai/artifact/FU1n5dXscsn3BEVLZ6C5op>). Borrarlo es irreversible y se lleva sus
   respuestas: leerlas y dejar lo que sirva en `docs/diseno.md` antes.
4. Comprobar que no queda nada: `grep -rn "diseno-temporal\|galeria-temporal" . --exclude-dir=node_modules --exclude-dir=.git` → 0.
