# Manual de uso — ElectBot

Guía práctica por rol. ElectBot permite, el día de una interna, saber en tiempo real quién consultó, quién votó y la participación de cada mesa — desde Telegram, sin instalar nada.

> **Rutas:** cada municipio en `<dominio>/<slug>/admin`, `/<slug>/dashboard`, `/<slug>/pwa`.
> En dev: `<dominio>` = `localhost:3001`. En producción: el dominio que tengas configurado en Vercel.

---

## 1. Administrador del municipio

Es el responsable de cada comité. Prepara y vigila la operación.

**Ingreso:** `<dominio>/<slug>/login` con las credenciales que te creó el sistema o el administrador correspondiente.

### Cargar operadores
En **Operadores**:
- **Nombre** (opcional), **Teléfono** (obligatorio), **Rol** (Mesa Guía o Veedor).
- **Puesto** (Mesa Guía) o **Mesa** (Veedor): **opcional**, pero recomendado — mejora la precisión de las alertas.
- "Agregar operador". También podés **bloquear/activar** y copiar el **link de la PWA** (ícono 🔗).

> No hay que "aprobar" a nadie: al cargarlo ya queda habilitado. El operador queda *sin vincular* hasta que haga /start en el bot.

### Canales habilitados
Tarjeta **"Canales habilitados"**: marcá **Telegram** y/o **PWA**. Ambos pueden estar activos a la vez. Si desmarcás uno, las operaciones por ese canal se rechazan (útil para forzar la contingencia).

### Alertas
En **Alertas** ves, en vivo y por gravedad:
- 🟡 **Amarilla**: el elector ya consultó en el mismo puesto.
- 🟠 **Naranja**: consultó en otro puesto/local.
- 🔴 **Roja**: intentan consultar a alguien que ya votó.
- 🟥 **Crítica**: un veedor marcó a alguien que no es de su mesa.

---

## 3. Operador (Mesa Guía / Veedor)

Opera en el campo, desde Telegram (o la PWA si hay contingencia).

### Vincularse (una vez)
1. Abrí el bot que te pasó el admin y tocá **Iniciar** (`/start`).
2. Tocá **"📱 Compartir mi número"** (comparte tu número propio, un toque, no abre la lista de contactos).
3. Si tu número está cargado, quedás habilitado al instante.

### Mesa Guía — orientar
Escribí el número de cédula. El bot responde dónde vota la persona:
```
✅ NO VOTÓ AÚN
Pérez, Juan
Local: Escuela N°3 · Mesa 12 · Orden 45
```
Si hay algo raro, te avisa con una alerta (amarilla/naranja/roja).

### Veedor — marcar voto
Escribí la cédula cuando la persona vota:
```
🗳️ VOTO REGISTRADO
Pérez, Juan · Mesa 12
```
- **Corregir** (si te equivocaste, hasta 7 minutos): escribí `CORREGIR 1234567`.
- Si marcás a alguien de otra mesa, el voto se registra igual pero salta una **alerta crítica** al admin.

### Formatos de cédula
Da igual cómo la escribas: `1.234.567`, `1234567`, `1-234-567` o con espacios — todas se interpretan igual.

### Contingencia (PWA)
Si Telegram falla, abrí el **link de la PWA** que te guardó el admin en tu celular. Funciona igual: escribís el CI y obtenés la misma respuesta. Solo opera si el admin activó el canal PWA.

---

## 4. Candidato

**Ingreso:** `<dominio>/<slug>/dashboard`. Tablero en vivo (se actualiza solo cada 30 segundos):
- **% de participación** (anillo), votaron, pendientes, consultados.
- **Evolución horaria** de los votos.
- **Ranking de operadores** más activos.
- **Alertas** por severidad.

No muestra cédulas ni datos personales: solo totales y agregados.

---

## Privacidad y seguridad

Cada rol ve solo lo que necesita. Los operadores no ven la base completa ni teléfonos; el candidato solo ve totales. Cada acción queda registrada de forma inalterable para auditoría. Los datos de un municipio están aislados del resto.
