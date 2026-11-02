# Control P&V · v0.1

App móvil y web para registrar el ciclo completo de cada disparo de avance (diseño → perforación → vale → carguío → resultado → devolución → checklist → cierre). Funciona sin señal y sincroniza con Supabase. Sirve para varias minas: cada unidad tiene sus catálogos, clases de roca, metas y checklist.

## Requisitos
- Node.js 22 o superior
- Para el APK: Android Studio (incluye el JDK y el SDK de Android)

## Probar en la PC (5 minutos)
```bash
npm install
npm run dev
```
Abre la dirección que aparece (http://localhost:5173) y entra con tu usuario de Supabase.
Para probar en el celular conectado al mismo Wi-Fi, usa la dirección "Network" que muestra la consola.

El archivo `.env` ya trae la URL y la clave publishable del proyecto `control-pyv-mina`.

## Generar el APK de Android
```bash
npm run android:init     # solo la primera vez: crea la carpeta android/
npm run android          # compila, copia y abre Android Studio
```
En Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. El APK queda en
`android/app/build/outputs/apk/debug/app-debug.apk`. Cópialo al celular e instálalo (permite "orígenes desconocidos").

Después de cada cambio en el código: `npm run android` y vuelve a compilar en Android Studio.

## Cómo funciona sin señal
1. Todo se guarda primero en el celular (IndexedDB) y entra en una cola.
2. Al haber señal (al abrir la app, al reconectarse o cada 60 s) se envía la cola a Supabase con *upsert* por id: reenviar no duplica.
3. Luego baja los cambios de otros usuarios (por `updated_at`). Lo pendiente local no se sobrescribe hasta enviarse.
4. Si el servidor rechaza un cambio (permisos, número duplicado), aparece en la pantalla de inicio con opción de reintentar o descartar.

**Importante:** el primer inicio de sesión necesita señal (para descargar catálogos y permisos). No cierres sesión con cambios pendientes.

## Pruebas
```bash
npm test        # motor de indicadores (11 pruebas)
npm run e2e     # flujo completo con Supabase simulado (requiere Playwright)
```

## Estructura
```
src/lib/calc.ts     fórmulas (FC, eficiencia, desviación vs receta, conciliación, clasificación)
src/lib/db.ts       base local + cola de envío
src/lib/sync.ts     sincronización con Supabase
src/screens/        Login, Inicio, Disparo (8 etapas)
supabase/           SQL ya ejecutado en el proyecto
```

## Pendiente (siguientes fases)
- Fotos (cámara + subida diferida al bucket `fotos`)
- SQLite nativo en Android en lugar de IndexedDB (más robusto ante limpieza del sistema)
- Pantallas de administración (labores, secciones, productos, usuarios); por ahora se editan en el Table Editor de Supabase
- Tablero de gerencia, gráfico I-MR, estudios antes/después, módulo de diseño Holmberg, importación del Excel, PDF
