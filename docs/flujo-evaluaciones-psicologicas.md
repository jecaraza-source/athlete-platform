# Flujo de Evaluaciones Psicológicas
Esta guía describe el flujo clínico de evaluaciones psicológicas, los límites de acceso y la operación del módulo.

## Alcance y acceso
- Las evaluaciones pertenecen al atleta y sus respuestas crudas son datos clínicos.
- El rol `mental_health_admin` puede programar, leer respuestas, documentar la revisión, aprobar y publicar.
- En el entorno actual, el acceso clínico está asignado únicamente a `soporte@aodeporte.com` y `psi04@aodeporte.com`.
- Entrenadores y dirección sólo consumen las vistas autorizadas por sus permisos y RLS; no reciben respuestas crudas.
- La app móvil del atleta sólo recibe resúmenes clínicos aprobados y publicados.

## Estados de una evaluación
1. `pending`: la evaluación fue programada y sólo puede responderse a partir de `scheduled_for`.
2. `under_review`: el atleta terminó de responder; un profesional debe revisar los datos.
3. `approved`: un profesional guardó el resumen clínico y aprobó explícitamente la evaluación.
4. `expired`: evaluación cancelada o vencida; no acepta respuestas.

Una evaluación publicada conserva `status = approved` y registra `published_to_athlete`, `published_by` y `published_at`.

## Flujo operativo
1. Un profesional con `psych.schedule_assessments` programa un instrumento activo, licenciado y con banco de reactivos completo.
2. El atleta autenticado abre el cuestionario dentro de la ventana habilitada y responde todos los reactivos.
3. El backend valida códigos, opciones y completitud antes de guardar respuestas.
4. La evaluación pasa a `under_review`; se notifica al profesional programador.
5. El profesional guarda `clinical_summary` y, cuando aplique, interpretaciones por subescala.
6. El profesional aprueba la evaluación. La aprobación registra `approved_by` y `approved_at`.
7. Sólo una evaluación aprobada con resumen clínico puede publicarse al atleta.
8. El historial móvil muestra exclusivamente instrumento, fecha y resumen clínico de evaluaciones aprobadas/publicadas.

## Scoring y alertas
- SCAT es el único instrumento con scoring automático habilitado actualmente (`scoring_mode = automated`).
- Para SCAT, una banda de ansiedad competitiva alta genera una alerta de severidad alta idempotente.
- ABQ, CSAI-2, SMTQ, TOPS, BASC y cualquier instrumento sin política validada permanecen en `manual_review`: no generan scores ni alertas automáticas.
- Para activar scoring automático en otro instrumento se requiere una política versionada con algoritmo, baremos, opciones válidas y pruebas de regresión.

## Licencias
El estado global de un instrumento se deriva de cuatro verificaciones auditables:
- `instrument_use`
- `digital_reproduction`
- `official_scoring`
- `spanish_translation`

El estado sólo queda habilitado cuando las cuatro verificaciones son `licensed` o `not_required`. Un estado `denied` bloquea el instrumento.

## Pausa y reanudación
La pausa temporal del módulo se realiza mediante `20261005000005_pause_psychological_assessments.sql`:
- desactiva instrumentos;
- vence evaluaciones pendientes;
- revoca la RPC del historial publicado.

La reanudación se realiza mediante `20261013000001_resume_psychological_assessments.sql`:
- reactiva instrumentos no técnicos;
- restaura la RPC del historial;
- vuelve a publicar únicamente evaluaciones previamente publicadas que ya están aprobadas.

No se deben fabricar resúmenes clínicos para reactivar resultados históricos: los registros sin `clinical_summary` requieren revisión profesional antes de mostrarse al atleta.

## Verificación
Pruebas locales:

```sh path=null start=null
npm run test:run -- tests/psych
npx tsc --noEmit
npm --prefix apps/mobile run test:run
npm --prefix apps/mobile exec tsc -- --noEmit
```

Prueba E2E remota con una cuenta de atleta de pruebas:

```sh path=null start=null
E2E_PSYCH_TEST_ENABLED=true npm run test:psych:e2e
```

La prueba debe crear un assessment temporal, validar la respuesta autenticada del atleta, la revisión/aprobación clínica y limpiar sus datos al finalizar.
