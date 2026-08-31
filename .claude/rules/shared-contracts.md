---
paths:
  - "packages/shared/**/*.ts"
---

# Contratos compartidos (`@maya/shared`)

Única fuente de verdad de lo que la API y el cliente se intercambian:
enumeraciones, tipos de respuesta, constantes de capacidades (`CAP`), roles y
tokens de marca.

## Al tocar este paquete

`bun run build:shared` después de cada cambio. Los dos consumidores importan
desde `dist/`, no desde las fuentes: sin recompilar, siguen viendo la versión
anterior y los errores de tipo que aparecen no corresponden al código escrito.

Se emite en doble formato (CJS para la API, ESM para el cliente) mediante
`tsconfig.cjs.json` y `tsconfig.esm.json`, más `scripts/fix-esm.mjs` que añade
las extensiones que exige ESM. Un fichero nuevo debe exportarse desde
`src/index.ts` o no llegará a ninguno de los dos.

## Qué entra aquí

Entra lo que ambos lados necesitan conocer igual: formas de datos, enumeraciones
y constantes. No entra lógica de negocio, acceso a datos ni nada que dependa de
Nest, de Angular o de Mongoose — este paquete no tiene dependencias de tiempo de
ejecución y conviene que siga así.

## Capacidades

Una capacidad nueva se añade a `constants/capabilities.ts` y se referencia
siempre como `CAP.NOMBRE`, nunca como cadena literal: el literal no se renombra
con el resto y sobrevive a los cambios sin que el compilador avise.
