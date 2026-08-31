---
name: verificar
description: Ejecuta la cadena de verificación completa de Maya Classroom (contratos compartidos, typecheck, ESLint, pruebas y compilación de API y cliente) en el orden correcto y explica cómo interpretar cada fallo. Úsalo siempre antes de dar por terminado un cambio, antes de hacer commit o de abrir un pull request, y cuando el usuario pida "verifica", "comprueba que compila", "pasa los tests", "está listo?" o "revisa que no he roto nada". Úsalo también cuando una compilación o una prueba falle de forma extraña, porque la mayoría de esos fallos son de orden o de entorno y no del código.
argument-hint: "[api|web|todo]"
allowed-tools: Bash Read Grep Glob
---

# Verificar Maya Classroom

Reproduce en local lo que hace la integración continua, en el mismo orden. El
orden importa: cada paso deja preparado lo que el siguiente necesita, y saltarse
uno produce errores que no señalan la causa real.

## Antes de nada: el entorno

Los CLI de Nest y Angular se invocan con shebang `node` y Angular 22 exige
Node ≥ 22.22.3. Si el `node` del PATH es anterior, ninguna compilación
funcionará y el mensaje solo dirá que la versión no basta.

```bash
node -v
```

Si se queda corto, activar la versión que usa la integración continua:

```bash
export NVM_DIR="${NVM_DIR:-/opt/nvm}" && . "$NVM_DIR/nvm.sh" && nvm use 24
```

En las sesiones remotas `.claude/hooks/session-start.sh` ya lo deja resuelto;
esta comprobación es la red de seguridad para cuando no se ha ejecutado.

## La cadena

Ejecutar desde la raíz del repositorio y **parar en el primer fallo**: seguir
adelante solo genera errores derivados que despistan.

```bash
bun install                                    # 1
bun run build:shared                           # 2
bunx tsc -p apps/api/tsconfig.json --noEmit    # 3
bun run lint                                   # 4
bun run test                                   # 5
bun run build:api                              # 6
bun run build:web                              # 7
```

Con un argumento (`api`, `web`) se puede recortar el alcance, pero los pasos 1
y 2 se ejecutan siempre: son la base de todo lo demás.

## Qué significa cada fallo

**Paso 2 falla** → hay un error de tipos en `packages/shared`. Se arregla ahí;
nada más va a compilar hasta entonces.

**Paso 3 se queja de que no encuentra `@maya/shared`** → no es un error de
tipos, es que el paso 2 no se llegó a ejecutar o falló. Los consumidores
importan desde `dist/`, no desde las fuentes.

**Paso 4, `consistent-type-imports`** → una importación de solo tipo se escribió
como importación normal. Corregirla a `import type`, no desactivar la regla: el
transpilador de Bun procesa cada fichero por separado, la emitiría como
importación real y fallaría en ejecución.

**Paso 4, `no-explicit-any`** → está en `error` a propósito. Estrechar desde
`unknown` en vez de silenciarlo.

**Paso 5** → `bun test` sobre `apps/api`. Para reproducir un solo fichero hay
que situarse en `apps/api`; desde la raíz falla con `undefined is not an object
(evaluating 'target.constructor')` porque no se precarga `reflect-metadata`:

```bash
cd apps/api && bun test src/modules/rbac/access.service.spec.ts
```

**Paso 7, aviso de presupuesto de estilos** → un `.scss` de componente superó
su límite en `apps/web/angular.json`. Primero mirar si hay estilos que
pertenecen al sistema global (`styles/_components.scss`); subir el presupuesto
es la salida cuando el componente ha crecido de verdad.

## Al terminar

Informar del resultado de cada paso tal cual salió. Si algo quedó sin
ejecutar, decirlo explícitamente en lugar de dar por buena la cadena entera.
Para un cambio visual, `/revisar-ui` comprueba lo que esta cadena no ve:
que además de compilar, se vea bien.
