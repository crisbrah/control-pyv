# Control P&V · v0.1

App móvil y web para registrar el ciclo completo de cada disparo de avance (diseño → perforación → vale → carguío → resultado → devolución → checklist → cierre). Funciona sin señal y sincroniza con Supabase. Sirve para varias minas: cada unidad tiene sus catálogos, clases de roca, metas y checklist.

## Administración (ícono de engranaje en Inicio; ingeniero y admin)
- **Secciones, labores y explosivos**: crear, editar y desactivar. Funciona sin señal y se sincroniza.
- **Usuarios** (solo admin, con señal): la persona crea su cuenta en la app ("Crear cuenta") y el admin le asigna un rol con su correo.
  Requiere ejecutar UNA vez `supabase/04_admin.sql` en el SQL Editor de Supabase.

## Reportes y análisis
- **Reporte de voladura (PDF)**: en la etapa Cierre de cada disparo. Indicadores, macizo, perforación, carga por zona frente al estándar, conciliación, resultado, checklist y alertas.
- **Análisis de varias voladuras**: en Inicio pulsa "Analizar", marca 2 o más (recomendado 3+ de la misma sección) y pulsa "Analizar N voladuras".
  Incluye conclusiones automáticas, estadísticos, comparación con la línea base, descomposición carga/avance, gráfico de control I-MR, carga frente a avance,
  cumplimiento por zona y prueba U de Mann-Whitney. Se descarga en PDF.
- En el celular, el PDF se abre con el menú Compartir (WhatsApp, correo, Drive).

## Diseño de malla (pestaña Diseño)
Modelo de Holmberg (López Jimeno et al., 1995), verificado con el caso CX-400 (44 taladros, 403 cartuchos, 105.3 kg, 14.45 kg máx. por retardo).
- Parámetros editables marcados como dato o supuesto; explosivos del catálogo de la mina.
- Malla 2D con forma y color por zona, rimados y número de retardo; animación de la secuencia LP 1–16; carga por retardo.
- Avisos: arranque que limita el avance, carga del arranque bajo la mínima, burden negativo.
- Ingeniería guarda el diseño como estándar (propuesto o vigente). Los disparos nuevos usan el vigente.

## Simulador (pestaña Simulador)
Estimación de tres puntos (PMBOK) con distribución Beta-PERT + Monte Carlo en dos niveles.
- Variables: calibración sobre el diseño, eficiencia de avance, variabilidad de carga y de avance; cada una con optimista / más probable / pesimista y la fuente de cada valor.
- El pesimista por defecto es "nada cambia" (la línea base real).
- Resultado: FC medio de una campaña de validación (10 disparos por defecto) en P10 / P50 / P90, probabilidad de cumplir la meta, tornado de sensibilidad y máxima calibración admisible.
- La línea base sale de los disparos reales cerrados de la sección sin estándar aplicado. Todo rotulado como SIMULACIÓN.

## Requisitos
- Node.js 22 o superior
- Para el APK: Android Studio (incluye el JDK y el SDK de Android)

## Probar en la PC sin servidor (modo demo)
```bash
npm install
npm run demo
```
Abre http://localhost:5173 y entra con **cualquier correo y contraseña**. Simula Supabase dentro del navegador con los 9 disparos del CX-400, el catálogo FAMESA y el estándar Holmberg. Para probar sin señal: F12 → pestaña Network → "Offline".
Los datos del demo viven solo en ese navegador y no se mezclan con los reales.

## Probar en la PC con Supabase real
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
npm test        # indicadores, Holmberg, simulación y análisis (46 pruebas)
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
