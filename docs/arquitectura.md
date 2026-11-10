# Arquitectura — SecureTasks

## Diagrama de arquitectura

```mermaid
flowchart LR
  U[Navegador] -->|HTTPS| N[Next.js App Router]
  subgraph N[Aplicación Next.js único servicio]
    P[Páginas React] --> R[Route Handlers /api]
    R --> S[lib/security: Zod, Argon2id, rate limit, auditoría]
    R --> SE[lib/session: sesiones y roles]
    S --> PR[Prisma Client]
    SE --> PR
  end
  PR -->|red privada| DB[(PostgreSQL)]
```

## Flujo de autenticación

```mermaid
sequenceDiagram
  participant C as Cliente
  participant A as /api/auth/login
  participant DB as PostgreSQL
  C->>A: email + contraseña
  A->>A: validar con Zod
  A->>DB: contar fallos por IP o correo (15 min)
  alt 5 fallos o más
    A-->>C: 429 + Retry-After
  else permitido
    A->>DB: buscar usuario
    A->>A: verificar Argon2id
    alt inválido
      A->>DB: registrar fallo y auditoría
      A-->>C: 401
    else válido
      A->>DB: guardar hash SHA-256 del token de sesión
      A-->>C: 200 + cookie HttpOnly (24 h)
    end
  end
```

## Roles

| Rol | Permisos |
|---|---|
| estudiante | CRUD de sus propias tareas |
| docente | Lo anterior + resumen de actividad de estudiantes |
| administrador | Todas las tareas, gestión de usuarios y roles, auditoría |

## Estructura

- `src/app/api/**`: API REST (Route Handlers)
- `src/app/*/page.tsx`: interfaz (login, registro, recuperación, dashboard)
- `src/lib/`: seguridad, sesiones, cliente Prisma
- `prisma/`: esquema y migración `20260101000000_init`
- `tests/`: pruebas automatizadas con Vitest
- `docs/`: documentación de seguridad
