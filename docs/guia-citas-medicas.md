# Guía de Uso — Módulo de Citas y Agendas
## Plataforma AO Deportes · Staff Médico y Especialistas

**Versión:** Junio 2026  
**Aplica a:** Médicos · Psicólogos · Nutriólogos · Fisioterapeutas · Coordinadores

---

## ¿Qué hay de nuevo?

La plataforma ahora cuenta con un módulo dedicado para gestionar las citas de tu especialidad.
Desde aquí puedes ver tus próximas citas, registrar asistencia, anotar observaciones de consulta
y reagendar directamente en caso de inasistencia — todo sin salir del sistema.

Los atletas reciben notificaciones automáticas en su app móvil cada vez que su cita es
modificada o registrada como inasistencia.

---

## ¿Cómo acceder?

En el menú lateral de la plataforma web, selecciona:

> **Seguimiento → Mis citas médicas**

O accede directamente desde el dashboard principal. Verás únicamente las citas asignadas
a tu perfil. Los administradores y coordinadores de programa pueden ver todas las citas del sistema.

---

## Pantalla principal — Lista de citas

Al ingresar verás dos secciones:

### Próximas · pendientes de acción
Citas con fecha igual o posterior a hoy. Las que tienen un **punto azul** al lado del nombre
del atleta requieren que registres la asistencia.

### Historial reciente
Las últimas 50 citas ya cerradas, ordenadas por fecha más reciente.

Cada fila muestra:
- Fecha y hora de la cita
- Nombre del atleta
- Tipo de servicio
- Estado actual con su etiqueta de color:

| Color | Estado | Significado |
|---|---|---|
| 🔵 Azul | **Programada** | Pendiente de atención |
| 🟢 Verde | **Atendida** | Cita confirmada con asistencia |
| 🔴 Rojo | **No asistió** | El atleta no se presentó |
| 🟡 Ámbar | **Reagendada** | Se creó una nueva cita |
| ⚪ Gris | **Cancelada** | Cita cancelada |

Haz clic en cualquier fila para abrir el detalle de la cita.

---

## Pantalla de detalle de cita

### Encabezado de la cita
Muestra la información completa:
- **Nombre del atleta** y tipo de servicio
- **Fecha y hora** de la cita
- **Duración estimada** (calculada automáticamente)
- **Folio de referencia** (ej. `APT-20260614-A1B2C3`) — úsalo si necesitas hacer referencia a esta cita con administración

### Historial del atleta
Un panel colapsable (toca **"Historial del atleta ▼"**) que muestra:
- Total de citas previas y número de asistencias
- **Tasa de asistencia** en porcentaje
- Última cita registrada con su estado
- Lista de las 5 citas más recientes
- Enlace directo al **expediente completo del atleta**

Este panel te ayuda a identificar rápidamente patrones de inasistencia antes de atender la consulta.

---

## Registro de asistencia

Para citas con estado **"Programada"** aparece la sección de registro con tres botones:

---

### ✅ El atleta atendió

1. Pulsa el botón verde **"Atendió"**
2. Aparece el formulario de **Notas de la consulta**
3. Escribe tus observaciones — el sistema **guarda automáticamente** mientras escribes (verás el indicador "✓ Guardado" en la esquina inferior del campo)
4. Cuando termines, pulsa **"✅ Confirmar asistencia y guardar notas"**

La cita cambia a estado **"Atendida"** y queda en modo solo lectura. No se puede modificar después.

> **Consejo:** El guardado automático ocurre 1.5 segundos después de que dejas de escribir.
> Si cierras el navegador sin confirmar, las notas quedan guardadas como borrador pero
> la cita sigue como "Programada".

---

### ❌ El atleta no asistió

1. Pulsa el botón rojo **"No atendió"**
2. Selecciona el **motivo** de la inasistencia (opcional):
   - Sin aviso previo
   - Avisó con anticipación
   - Emergencia personal
   - Otro motivo
3. Agrega **notas adicionales** si lo consideras necesario
4. Decide qué hacer a continuación:

   **Opción A — Solo registrar inasistencia:**
   Pulsa **"No, solo registrar inasistencia"** o **"❌ Confirmar No Show"**.
   La cita queda como "No asistió" y el atleta recibe una notificación push en su app.

   **Opción B — Reagendar inmediatamente:**
   Pulsa **"Sí, abrir calendario →"** para pasar directo al flujo de reagendamiento
   (los motivos que escribiste se llevan automáticamente como notas de contexto).

> **Nota:** Cuando se registra "No asistió", el atleta recibe una notificación push que dice:
> *"No se registró tu asistencia a la cita de hoy. Contáctanos si fue un error."*

---

### 🔄 Reagendar

Usa esta opción cuando necesites mover la cita a otra fecha/hora, ya sea antes o durante el día de la cita.

El proceso es en **3 pasos**:

#### Paso 1 · Elige una fecha
Navega el calendario con las flechas `‹` `›` para cambiar de mes.
- Los días en **gris claro** (pasados) no están disponibles
- El día de **hoy** aparece con borde azul
- Haz clic en el día deseado para seleccionarlo (se resalta en índigo)

#### Paso 2 · Elige un horario disponible
Al seleccionar una fecha, el sistema carga automáticamente los **horarios disponibles** de tu agenda:
- Los botones **habilitados** son horarios libres
- Los botones con texto **tachado y gris** ya están ocupados por otra cita
- Selecciona el horario haciendo clic sobre él

> Los horarios se generan según la disponibilidad configurada en tu perfil (de lo contrario,
> el sistema usa el horario predeterminado: 9:00 AM a 5:00 PM en bloques de 30 minutos).

#### Paso 3 · Notas del reagendamiento (opcional)
Escribe el motivo del cambio. Si llegaste aquí desde el flujo de "No asistió", las notas
se pre-llenan automáticamente con el motivo de inasistencia.

#### Confirmar el reagendamiento
Cuando tengas fecha, hora y notas listas, aparece un resumen de confirmación:

> *martes, 24 de junio de 2026 · 10:00 AM*

Pulsa **"🔄 Confirmar reagendamiento"** para:
1. Cerrar la cita original con estado **"Reagendada"**
2. Crear una **nueva cita** con la fecha y hora elegidas
3. Enviar una **notificación push** al atleta con la nueva fecha

El atleta recibe en su app: *"📅 Tu cita fue reagendada — Nueva cita: martes, 24 de junio de 2026, 10:00 AM"*

---

## Vista de solo lectura (cita cerrada)

Una vez que una cita tiene estado "Atendida", "No asistió", "Reagendada" o "Cancelada",
se muestra en modo **solo lectura**. Verás:

- Resumen completo de la cita con su estado final
- Notas de consulta guardadas (si las hay)
- Motivo de inasistencia (si aplica)
- Nombre de quién registró la acción y la fecha/hora de registro
- Si fue reagendada: enlace directo a la **nueva cita** creada

> Los administradores y coordinadores de programa pueden editar citas cerradas
> desde esta misma vista.

---

## Preguntas frecuentes

**¿Puedo ver las citas de mis colegas?**
No. Cada especialista solo ve las citas asignadas a su perfil. Los administradores y
coordinadores de programa ven todas las citas del sistema.

**¿Qué pasa si confirmo una asistencia por error?**
Una vez cerrada, no puedes deshacer la acción directamente. Contacta a tu administrador
para corregirla desde el panel de administración.

**¿Dónde veo si el atleta recibió la notificación?**
Las notificaciones push son de "mejor esfuerzo" — se envían si el atleta tiene la app
instalada y las notificaciones activadas. Puedes verificar el estado de los dispositivos
registrados en **Preferencias → Notificaciones**.

**¿Los reagendamientos aparecen en el calendario general?**
Sí. Cada nueva cita creada por reagendamiento aparece en el **Calendario** de la plataforma
como cualquier otro evento de tipo "médico".

**¿Puedo agregar notas a una cita antes del día de la consulta?**
Sí. Abre la cita y usa el campo de notas (aparece al seleccionar "Atendió"). El sistema
guarda automáticamente tu borrador sin necesidad de confirmar la asistencia.

**¿Qué es el folio de referencia?**
Es un código único por cita (ej. `APT-20260614-A1B2C3`) que puedes usar para identificar
la cita al comunicarte con administración o en documentos físicos.

---

## Roles y permisos

| Perfil | Puede ver | Puede registrar | Puede editar cerradas |
|---|---|---|---|
| Médico / Psicólogo / Nutriólogo / Fisioterapeuta | Sus propias citas | Sus propias citas | No |
| Administrador | Todas | Todas | Sí |
| Director de programa | Todas | Todas | Sí |
| Coordinador de eventos | Todas | Todas | Sí |

---

## Soporte

Si encuentras algún problema o tienes dudas sobre el uso del módulo, abre un **ticket de soporte**
desde la plataforma:

> **Menú lateral → Tickets → + Nuevo ticket**

Describe brevemente el problema y el equipo técnico lo atenderá a la brevedad.

---

*AO Deportes — Plataforma de Gestión Deportiva Integral*  
*aodeporte.com · privacidad@aodeporte.com*
