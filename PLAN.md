# Plan de desarrollo — DTNotes

Plan de desarrollo **local**, por **tareas pequeñas y concretas**, para ir avanzando y **validando poco a poco en la PC**. Reglas del plan:

- Se entrega y ejecuta **una tarea (o subtarea) cada vez**, esperando tu validación local antes de seguir.
- Cada fase termina en un estado **probable en local** y con un **commit + push a GitHub** (hito).
- **El despliegue en Zeabur va al final del todo** (Fase 11); hasta entonces, todo corre en local.

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecho y validado.

---

## Fase 0 — Repositorio y control de versiones ✅
Repositorio remoto (ya creado): `https://github.com/dvdramses89/dathasoft-notes.git`
- [x] 0.1 Inicializar git local + `.gitignore` (node_modules, dist, `.env`…) + `README.md`.
- [x] 0.2 Conectar el repo local con el remoto existente como `origin` y primer push a `main` (conservado el `LICENSE` remoto vía rebase).
- [x] 0.3 Estructura monorepo vacía con workspaces: `apps/web`, `apps/api`, `packages/shared`, `package.json` raíz.
- **Validación**: repo en GitHub con la estructura base. ✅ *(commit `942e1cb` pusheado a `main`)*

## Fase 1 — Andamiaje levantable en local (sin features) ✅

### Tarea 1.1 — Backend API (NestJS) ✅
- [x] 1.1.a Scaffold de la API NestJS con endpoint `GET /api/health`, arranca en local.
- [x] 1.1.b Config de entorno de la API: `@nestjs/config` + `.env` / `.env.example` (`PORT`, `NODE_ENV`…).
- **Validación**: la API arranca en local y responde `/api/health`. ✅ (NestJS 11 + TypeScript 5, `GET /api/health` → `{status:"ok", env:"development", ...}`)

### Tarea 1.2 — Frontend genérico conectado al backend (React + Vite + TS) ✅
- [x] 1.2.a Scaffold de la web React + Vite + TS mínima ("DTNotes"), arranca en local.
- [x] 1.2.b Config `.env` / `.env.example` con `VITE_API_URL` + cliente HTTP que llama a `/api/health` y pinta el estado del backend.
- **Validación**: la web arranca en local y muestra que se conecta con la API. ✅ (React 18 + Vite 8; card con estado de conexión al backend)

> **Fase 1 cerrada.** Andamiaje completo: API (`/api/health`) + Web (SPA con estado de conexión). Scripts raíz: `npm run dev:api`, `npm run dev:web`, `npm run db:up`/`db:down`.

## Fase 2 — Base de datos + autenticación
- [x] 2.1 Postgres local vía **Docker Compose** + Prisma + `DATABASE_URL` en `apps/api/.env`.
- [x] 2.2 **Esquema COMPLETO** (13 tablas + 2 enums) + **migración inicial** aplicada + buscador full-text (`searchVector` generado + índice GIN, config `spanish`). Verificado con prueba funcional.
- [x] 2.2b **Prisma conectado a NestJS**: `PrismaModule` global + `PrismaService` (connect/disconnect + shutdown hooks) + endpoint `GET /api/health/db` (`SELECT 1`). Verificado.
- [x] 2.3 API auth (completa):
  - [x] 2.3.a Registro (`POST /api/auth/register`) con hash `bcryptjs` + validación de DTOs (`ValidationPipe` global). Verificado: 201, 409 duplicado, 400 inválido/campo extra; hash en BD.
  - [x] 2.3.b Login (`POST /api/auth/login`) → JWT (`@nestjs/jwt`, secreto y expiración por `.env`). Verificado: 200 + token válido (sub/email/exp +1d), 401 en credenciales inválidas.
  - [x] 2.3.c Guard JWT (`@nestjs/passport` + `passport-jwt`) + endpoint protegido `GET /api/auth/me` + decorador `@CurrentUser`. Verificado: 401 sin token / token inválido, 200 + usuario con token válido.
- [x] 2.4 Web: pantallas de registro/login, guardado de token (localStorage), ruta protegida (`react-router-dom`, `AuthContext`, `ProtectedRoute`). Build OK; flujo visual a validar en navegador.
- **Validación**: registrarse, iniciar sesión y entrar a una ruta protegida. *(Commit + push)*

> **Fase 2 cerrada.** Autenticación completa de punta a punta (backend + frontend).

> Nota: se decidió crear el esquema completo de una vez. Por eso, en las Fases 3–9 **las tablas ya existen**: esas fases solo construyen la **API + UI** sobre el modelo ya migrado (no vuelven a tocar el esquema salvo ajustes puntuales).

## Fase 3 — Categorías (árbol de carpetas estilo Craft)
- [x] 3.1 CRUD REST de categorías (el modelo/migración ya existían): `POST/GET/PATCH/DELETE /api/categories`, protegido por JWT y scoped al owner. Árbol anidado, renombrar/color/icono/reordenar. **Mover** (`PATCH /:id/move`) y **borrar** (`DELETE /:id?mode=`) con dos modos: `subtree` (toda la estructura) o `single` (solo la carpeta; hijas suben al padre inmediato). Prevención de ciclos. Verificado (ambos modos).
- [~] 3.2 Web: sidebar en árbol (estilo Craft) — por sub-tareas:
  - [x] 3.2.a Árbol visible + expandir/contraer + selección + **crear** (la carpeta seleccionada es el padre; raíz si no hay selección). App shell con sidebar + contenido.
  - [x] 3.2.b Renombrar (inline) + borrar con **diálogo de modo** (subtree/single) cuando la carpeta tiene subcarpetas; confirmación simple si está vacía.
  - [x] 3.2.c Mover con **selector de destino** (modal, con modo subtree/single) + **reordenar entre hermanas con drag & drop** (endpoint `PATCH /categories/reorder`). Drag & drop entre carpetas distintas queda como mejora futura.
- **Validación**: gestionar carpetas y subcarpetas en el sidebar. *(Commit + push)*

> **Fase 3 cerrada.** Categorías completas: API (CRUD + modos + reorder) y sidebar (árbol, crear, renombrar, mover, borrar, reordenar).

## Fase 4 — Documentos + editor BlockNote
- [x] 4.1 CRUD REST de documentos (el modelo/migración ya existían): `POST /api/documents`, `GET /api/documents` (listado ligero, filtro `?categoryId=<uuid>|root`), `GET /api/documents/:id` (con `contentJson`), `PATCH /:id` (guardar título/contenido), `PATCH /:id/move` (cambiar de carpeta), `PATCH /documents/reorder` (orden dentro de la carpeta), `DELETE /:id` (papelera, soft-delete). Todo protegido por JWT y scoped al owner. Verificado con 47 comprobaciones (incluido aislamiento entre usuarios y recálculo automático del `searchVector`).
- [~] 4.2 Web: editor **BlockNote** para crear/editar/guardar un documento dentro de una carpeta — por sub-tareas:
  - [x] 4.2.a Documentos en el sidebar (**carga perezosa**: los documentos de una carpeta se piden al expandirla) + botón de nuevo documento + apertura en `/documents/:id` con título editable y guardado. El árbol (`GET /categories`) devuelve `{tree, rootDocumentCount}` con `documentCount` por carpeta (una consulta agrupada), para saber si una carpeta tiene contenido sin cargar sus documentos: carpeta vacía = sin chevron. Selección única en el árbol (carpeta o documento, nunca los dos). Formulario de nueva carpeta con Crear/Cancelar.
  - [x] 4.2.b Editor **BlockNote** (variante `@blocknote/ariakit`; la de Mantine exige React 19) con **autoguardado** (debounce ~0,9 s + guardado al desmontar) e indicador Guardando/Guardado. `contentText` derivado del contenido para el buscador. Menús en español (locale `es`) y tema remapeado a la paleta de la app; barra de formato compactada y sin barras de desplazamiento. Verificado con Playwright: 19/19 sin errores de consola, y la barra medida en 6 anchos de ventana.
  - [x] 4.2.c Gestión de documentos desde la UI: renombrar inline (sincronizado con la página abierta), mover a otra carpeta o a la raíz (modal `MoveDocumentModal`, marca la carpeta actual), enviar a la papelera (cierra la vista si era el documento abierto) y reordenar con **drag & drop** dentro de la carpeta. Los contadores del árbol se refrescan en cada operación. Verificado con Playwright: 25/25 sin errores de consola.
- [ ] 4.3 Comprobar Markdown y **código con resaltado multi-lenguaje** en el editor.
- **Validación**: crear un documento en una carpeta, escribir texto enriquecido y código, guardarlo y reabrirlo. *(Commit + push)*

## Fase 5 — Tags + buscador global
- [ ] 5.1 Modelos `Tag` + `DocumentTag` + API para asignar/quitar tags.
- [ ] 5.2 Web: asignar tags a documentos y filtrar por tags.
- [ ] 5.3 **Buscador global**: búsqueda de texto (título + `contentText`, full-text de Postgres) combinable con tags.
- **Validación**: etiquetar documentos y encontrarlos con el buscador. *(Commit + push)*

## Fase 6 — Favoritos + Papelera
- [ ] 6.1 **Favoritos**: modelo `Favorite` + API + sección "Favoritos" en el sidebar.
- [ ] 6.2 **Papelera**: borrado suave (`deletedAt`) en documentos + API restaurar / borrar definitivo + sección "Papelera" en el sidebar.
- **Validación**: marcar favoritos y enviar/restaurar documentos de la papelera. *(Commit + push)*

## Fase 7 — Referencias externas en documentos
- [ ] 7.1 Bloque custom BlockNote: **enlace web**.
- [ ] 7.2 Bloque custom: **embed de YouTube**.
- [ ] 7.3 Bloque custom: **referencia a documento interno** del repositorio.
- [ ] 7.4 Bloque custom: **adjunto/referencia de archivo** (tabla `Attachment` + almacenamiento local vía `STORAGE_DRIVER=local`).
- **Validación**: insertar cada tipo de referencia en un documento y que funcione. *(Commit + push por subtarea)*

## Fase 8 — Importar y exportar
- [ ] 8.1 **Exportar** documento a **Markdown**.
- [ ] 8.2 **Exportar** documento a **PDF**.
- [ ] 8.3 **Importar** `.md` / `.txt` → documento, eligiendo la **subcarpeta destino**.
- [ ] 8.4 **Importar** `.docx` → documento (conversión), eligiendo subcarpeta destino.
- **Validación**: exportar en ambos formatos e importar los tres formatos a la carpeta elegida. *(Commit + push)*

## Fase 9 — Colectivos y compartición
- [ ] 9.1 Modelos `Collective` + `CollectiveMember` + API (crear colectivo, asignar usuarios).
- [ ] 9.2 `DocumentShare` + `CategoryShare` + API para compartir documento suelto o carpeta (subárbol) con permiso read/edit.
- [ ] 9.3 Web: UI para compartir + sección **"Documentos compartidos"** en el sidebar.
- **Validación**: compartir un documento y una carpeta con un colectivo y verlos desde otro usuario. *(Commit + push)*

## Fase 10 — Pulido final
- [ ] 10.1 Repaso UX del sidebar estilo Craft, estados vacíos y manejo de errores.
- [ ] 10.2 Repaso de autorización (owner / colectivo) y validaciones de entrada.
- **Validación**: recorrido completo de la app en local sin fisuras. *(Commit + push)*

## Fase 11 — Despliegue en Zeabur (al final del todo)
- [ ] 11.1 Preparar variables de entorno de producción (`.env.production` / secrets en Zeabur; `STORAGE_DRIVER` a objeto).
- [ ] 11.2 Crear proyecto en Zeabur + servicio **PostgreSQL**.
- [ ] 11.3 Desplegar **API** (build + migraciones Prisma en prod).
- [ ] 11.4 Desplegar **Web** (build de Vite, `VITE_API_URL` apuntando a la API).
- [ ] 11.5 Verificación end-to-end en producción.

---

> Cuando terminemos "Historial de versiones" (aparcado), se insertará como fase propia antes del pulido final.
