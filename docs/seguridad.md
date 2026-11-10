# Análisis de seguridad — SecureTasks

## 1. Modelado de amenazas STRIDE

| Categoría | Amenaza | Activo | Control implementado |
|---|---|---|---|
| **S**poofing (suplantación) | Robo de credenciales o de cookie de sesión; fuerza bruta de login | Cuentas, sesiones | Argon2id, cookie `HttpOnly`/`SameSite=Lax`/`Secure` (producción), token aleatorio de 256 bits guardado solo como hash SHA-256, expiración 24 h, revocación, bloqueo tras 5 fallos por IP o correo |
| **T**ampering (manipulación) | Modificar tareas ajenas (IDOR), inyectar SQL, alterar rol en el registro | Tareas, usuarios | Comprobación de propiedad en cada ruta `/api/tasks/[id]`, consultas parametrizadas con Prisma, validación con Zod, rol fijo `estudiante` en registro público |
| **R**epudiation (repudio) | Negar acciones sensibles | Registros de auditoría | Tabla `AuditLog` con acción, usuario, IP y fecha; sin contraseñas ni tokens (campos sensibles se reemplazan por `[REDACTED]`) |
| **I**nformation disclosure | Enumeración de usuarios, filtrado de tareas ajenas, fuga de hashes | Datos personales, tareas | Respuesta genérica en recuperación de contraseña, `select` explícito sin `passwordHash`, listados filtrados por `userId`, tokens de reset sin retorno en producción |
| **D**enial of service | Ráfagas de login, cuerpos enormes | Disponibilidad | Límite de intentos con 429 + `Retry-After`, longitudes máximas en Zod (título 150, descripción 2000) |
| **E**levation of privilege | Estudiante accede a funciones de docente o administrador | Gestión de roles y usuarios | Autorización por rol en el backend (403), auditoría `SECURITY_PRIVILEGE_ESCALATION_BLOCKED` |

## 2. Matriz de riesgos (Riesgo = Probabilidad × Impacto)

Escala: 1–4 Bajo · 5–9 Medio · 10–16 Alto · 17–25 Crítico. Valores de P e I entre 1 y 5, evaluados **antes** de mitigar.

| # | Amenaza | Activo | P | I | Riesgo | Nivel | Justificación | Mitigación |
|---|---|---|---|---|---|---|---|---|
| 1 | Elevación de privilegios (cambiar rol propio) | Roles / administración | 4 | 5 | 20 | Crítico | Un solo cambio de rol otorga control total | Verificación de rol en backend, rol fijo en registro, auditoría |
| 2 | IDOR sobre tareas | Tareas | 5 | 4 | 20 | Crítico | Manipular un id en la URL es trivial | Comprobación de propietario en GET/PUT/DELETE y filtro por `userId` |
| 3 | Fuerza bruta de credenciales | Cuentas | 5 | 4 | 20 | Crítico | Ataque automatizable y muy común | Bloqueo tras 5 fallos (15 min) por IP y correo, Argon2id, mensajes genéricos |
| 4 | SQL Injection | Base de datos | 3 | 5 | 15 | Alto | Impacto total si ocurre, poco probable con ORM | Prisma parametrizado, validación Zod, sin SQL crudo |
| 5 | Robo/reutilización de sesión | Sesiones | 3 | 5 | 15 | Alto | Da acceso completo como la víctima | Cookie HttpOnly, hash en BD, expiración, revocación en logout y reset |
| 6 | Reutilización de token de recuperación | Cuentas | 3 | 4 | 12 | Alto | Permite tomar la cuenta | Un solo uso, 15 min, invalida los anteriores, solo se guarda hash |
| 7 | XSS almacenado | Navegador del usuario | 3 | 4 | 12 | Alto | Contenido de tareas visible por otros (admin) | Escape automático de React, sin `dangerouslySetInnerHTML`, CSP |
| 8 | Enumeración de usuarios | Privacidad | 4 | 2 | 8 | Medio | Facilita ataques dirigidos | Respuestas genéricas en forgot-password y login |
| 9 | Repudio de acciones | Auditoría | 2 | 3 | 6 | Medio | Dificulta investigar incidentes | `AuditLog` con usuario, IP y acción |
| 10 | Denegación de servicio por volumen | Disponibilidad | 3 | 3 | 9 | Medio | Sin balanceador ni WAF | Límites de tamaño y rate limiting en login |

### Cinco amenazas prioritarias
1. Elevación de privilegios (20) · 2. IDOR (20) · 3. Fuerza bruta (20) · 4. SQL Injection (15) · 5. Robo/reutilización de sesión (15).

## 3. Plan de mitigación

| Prioridad | Acción | Estado |
|---|---|---|
| 1 | Autorización por rol en cada ruta de administración | Implementado y probado |
| 2 | Comprobación de propiedad en tareas | Implementado y probado |
| 3 | Rate limiting y bloqueo | Implementado y probado (bloqueo de ventana fija de 15 min) |
| 4 | Prisma parametrizado, sin SQL crudo | Implementado y probado |
| 5 | Sesiones con hash, expiración y revocación | Implementado y probado |
| Pendiente | Bloqueo progresivo creciente (hoy es ventana fija) | No implementado |
| Pendiente | Envío real de correo de recuperación (hoy el token se devuelve solo fuera de producción) | No implementado |
| Pendiente | Rate limiting en registro y recuperación de contraseña | No implementado |

## 4. Requisitos de seguridad verificables

| ID | Requisito | Criterio de aceptación | Prueba |
|---|---|---|---|
| RS-01 | Contraseñas con Argon2id | El hash almacenado empieza por `$argon2id$` | Registro y autenticación |
| RS-02 | Registro público solo crea estudiantes | Enviar `role: administrador` devuelve usuario `estudiante` | Registro y autenticación |
| RS-03 | Bloqueo por fuerza bruta | El 6.º intento devuelve 429 con `Retry-After`, aunque la clave sea correcta | Fuerza bruta |
| RS-04 | Sesiones con expiración | Sesión vencida devuelve 401 | Sesiones |
| RS-05 | Sesiones revocables | Tras logout el token anterior devuelve 401 | Sesiones |
| RS-06 | Cookie `HttpOnly` | La cabecera `Set-Cookie` incluye `HttpOnly` | Registro y autenticación |
| RS-07 | Token de recuperación de un solo uso | Segundo uso devuelve 400 | Recuperación |
| RS-08 | Un token activo por usuario | Un token nuevo invalida el anterior | Recuperación |
| RS-09 | Restablecer contraseña revoca sesiones | `/me` devuelve 401 tras el reset | Recuperación |
| RS-10 | Sin secretos en BD ni auditoría | Token y contraseña en claro ausentes | Recuperación |
| RS-11 | Anti-IDOR | Tarea ajena devuelve 403 en GET, PUT y DELETE | Tareas e IDOR |
| RS-12 | Control de roles | Estudiante recibe 403 en administración y resumen docente | Tareas e IDOR |
| RS-13 | Validación estricta | Entradas inválidas devuelven 400 | Validación |
| RS-14 | Sin SQL Injection | Payloads SQL no filtran datos ni alteran tablas | Validación |
| RS-15 | Sin XSS | Sin `dangerouslySetInnerHTML`; contenido devuelto como JSON | Validación |
| RS-16 | Acceso autenticado | Rutas protegidas sin sesión devuelven 401 | Tareas e IDOR |

## 5. Explicación de las correcciones

**SQL Injection.** Todo acceso a datos usa Prisma Client, que envía los valores como parámetros enlazados, nunca concatenados en la consulta. El único SQL directo es `SELECT 1` del endpoint `/api/health`, sin entrada de usuario. Además Zod valida tipo y longitud, y el filtro `status` se compara con una lista cerrada antes de usarse.

**IDOR.** Las rutas `/api/tasks/[id]` cargan la tarea y comparan `task.userId` con el usuario de la sesión; solo el administrador queda exento. El propietario nunca se toma del cuerpo de la petición. El listado filtra por `userId`. Los intentos bloqueados se registran como `SECURITY_IDOR_BLOCKED`.

**XSS.** React escapa el contenido de forma predeterminada y el código no usa `dangerouslySetInnerHTML` ni `innerHTML` (verificado por una prueba). Se añaden cabeceras `Content-Security-Policy`, `X-Content-Type-Options` y `X-Frame-Options`. La CSP actual conserva `unsafe-inline` y `unsafe-eval` por compatibilidad con Next.js, lo que la debilita; endurecerla con nonces queda pendiente.

## 6. Alcance de las pruebas

Las 27 pruebas llaman directamente a los Route Handlers con una base de datos **en memoria** (`tests/fakePrisma.ts`), por lo que están aisladas de cualquier PostgreSQL. Esto verifica la lógica de autenticación, autorización y validación, pero **no** ejecuta SQL real: la resistencia a SQL Injection se apoya en el uso de Prisma y en que los payloads se traten como datos. Una prueba de integración contra PostgreSQL de pruebas queda pendiente. Resultados reales: [resultados-pruebas.txt](resultados-pruebas.txt).
