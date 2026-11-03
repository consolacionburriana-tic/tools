# Libro de cambios · auditoría de las casillas de Alumnado

**Estado:** plan funcional ✅ · plan técnico ✅ · implementado 🟡 (3-nov-2026; falta probarlo con sesión real)

El 2-nov-2026 una persona de dirección cambió una protección de datos sin querer y no hubo forma fácil
de volver atrás. Ahora cada casilla que se marca en Alumnado deja una línea —quién, cuándo, cómo estaba,
cómo quedó— y se puede restaurar. Va con un **candado** en la protección de datos, para que el toque
suelto cueste un paso más.

## Decisiones cerradas

1. **Qué se anota.** Las casillas de la pestaña de Alumnado: protección de datos (imagen, redes, AMPA,
   ONG, desestimar el correo), banco de libros, familia socia del AMPA, comedor y complementarias. Una
   línea por alumno y casilla, **solo si el valor cambia** (marcar «sí» lo que ya era «sí» no deja ruido).
2. **Los cambios se agrupan por «lote»**: lo que se hizo de un clic (una clase, el centro entero, un
   «todos sí») comparte lote. La lista enseña lotes; abrir uno enseña las líneas.
3. **Restaurar, de dos formas** (David no sabía si por clase o por persona; así valen las dos):
   «Deshacer todo» sobre un cambio entero, o «Restaurar» una línea. En la ficha de cada alumno hay
   además su historial suelto.
4. **Una línea es restaurable mientras el valor de ahora sea el que dejó ese cambio.** No hay banderas de
   «revertido» ni «superado»: si alguien lo volvió a tocar después, ya no coincide y se salta (con el
   motivo); se deshace antes el cambio más nuevo y la anterior vuelve a valer. Una restauración nunca
   pisa en silencio un cambio posterior.
5. **Cada restauración es un cambio más** (origen «Restauración») y se puede deshacer a su vez. Las que no
   se pueden aplicar se cuentan y se dicen: «3 casillas restauradas · 2 sin tocar».
6. **Lo que viene de Educamos se anota y nada más** (David). El sync deja líneas de **alta, baja,
   reactivación, cambio de clase y banco que sigue al curso**, dentro del mismo `db.batch` que el sync. No
   tienen botón de restaurar. Lo apuntado desde **Nouvinguts** sí se puede restaurar (lo hizo una persona).
7. **Quién lo ve y lo usa: secretaría, dirección y TIC** (`puedeVerHistorialAlumnado`, el mismo grupo que edita
   la protección de datos). Cada restauración **vuelve a comprobar el permiso del tipo de casilla** (banco y
   AMPA exigen además el módulo del banco; comedor y complementarias, `puedeGestionarServicios`).
8. **Candado en la protección de datos** (solo ahí, «ya vemos el resto»): tabla y tarjeta de la ficha entran
   bloqueadas; hay que desbloquear para editar. Se cierra a los 5 minutos sin guardar y al salir de la
   pantalla. `ui/candado.tsx`, con su entrada en el escaparate.
9. **El registro no tiene claves foráneas** y guarda el **nombre y la clase del momento**: sobrevive a lo que
   le pase al alumno (baja, cambio de clase, borrado).
10. **Si anotar falla, el cambio del usuario se guarda igual** y el error queda en el log del servidor
    (`[auditoria]`): es peor perder lo que acaba de marcar que perder una línea del libro.

## Plan técnico

- Tabla `aud_cambios` (`src/db/sql/auditoria.sql`, **aplicado en Neon el 3-nov-2026**): `lote`, `por`, `origen`
  (`usuario` · `nouvinguts` · `educamos` · `restauracion`), `edu_student_id`, `alumno`, `clase`, `campo`, `antes`,
  `despues` (`'si'` · `'no'` · null = no consta).
- `src/lib/auditoria.ts` — puro y con tests: campos, etiquetas, `filasDeCambio`, `esRestaurable`.
- `src/lib/auditoria-server.ts` — `conAuditoria(ids, despues, ctx, escribir)` envuelve cada escritura (lee el
  antes, escribe, anota la diferencia); `lotesRecientes`, `entradasDeLote`, `entradasDeAlumno`, `restaurarEntradas`.
- Escritores que anotan: `guardarProteccion`, `guardarProteccionMasiva`, `guardarServicios`
  (`alumnado-server.ts`), `setBanco`, `setBancoVarios`, `setAmpa` (`bancolibros-server.ts`) y `aplicarSync`
  (`educamos-server.ts`). Restaurar **reutiliza esos mismos escritores** con origen `restauracion`.
- API: `GET /api/alumnado/historial` (`?lote=`, `?alumno=`, `?grupo=`, `?antesDe=`) y
  `POST /api/alumnado/historial/restaurar` (`{ ids }` o `{ lote }`).
- UI: `components/alumnado/historial-cambios.tsx` (`HistorialCambios`, `HistorialAlumno`).

## Checklist

- [x] Tabla aplicada en Neon (3-nov-2026) y consultas de lectura comprobadas contra Neon
- [x] Lógica pura con tests (`auditoria.test.ts`)
- [x] Escritores y sync de Educamos anotan
- [x] Pestaña «Historial de cambios», historial en la ficha, restaurar por línea y por cambio
- [x] Candado en la protección de datos
- [ ] **Probar con sesión real**: marcar una casilla, verla en el historial, restaurarla (con una persona de secretaría)
- [ ] Auditar la venta de materiales y decidir el candado para el resto de casillas
- [ ] Decidir si hay purga del registro (hoy crece sin límite)
