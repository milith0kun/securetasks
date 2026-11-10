# SecureTasks

Sistema web de gestión de tareas con enfoque de seguridad. Next.js (App Router) + TypeScript, PostgreSQL, Prisma, Zod, Argon2id y Vitest.

## Funcionalidades

- Registro, login, logout, recuperación y cambio de contraseña.
- CRUD, búsqueda y filtro de tareas (estados `pendiente`, `en_progreso`, `completada`).
- Roles `estudiante`, `docente` y `administrador`, con permisos comprobados en el backend.
- Perfil, administración de usuarios, resumen docente y auditoría.

## Instalación

```bash
npm install
cp .env.example .env        # configurar DATABASE_URL
npx prisma migrate deploy   # aplica prisma/migrations
npm run dev
```

El primer administrador debe crearse con un usuario registrado y cambiando su rol directamente en la base de datos (`UPDATE "User" SET role = 'administrador' WHERE email = '...'`), porque el registro público solo crea estudiantes.

## Pruebas

```bash
npm test
```

Las pruebas usan una base de datos en memoria, sin PostgreSQL. Resultado actual: 26 pruebas aprobadas ([docs/resultados-pruebas.txt](docs/resultados-pruebas.txt)).

## Despliegue (Nixpacks)

Servicio Next.js conectado a este repositorio con Nixpacks y una base PostgreSQL en la red privada. Variable requerida: `DATABASE_URL`. Comando previo al arranque: `npx prisma migrate deploy`. Este despliegue no se ha ejecutado ni verificado desde este repositorio.

## Documentación

- [Arquitectura y flujo de autenticación](docs/arquitectura.md)
- [STRIDE, matriz de riesgos, requisitos y mitigaciones](docs/seguridad.md)

## Limitaciones conocidas

- El bloqueo por fuerza bruta usa ventana fija de 15 minutos, no progresiva.
- La recuperación de contraseña no envía correo; fuera de producción devuelve el token en la respuesta.
- Las pruebas no se ejecutan contra PostgreSQL real.
