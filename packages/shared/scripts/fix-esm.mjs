/**
 * Añade la extensión correcta a las importaciones relativas de la compilación
 * ESM (`./x` → `./x.js`, o `./x/index.js` si es un directorio) y marca el
 * directorio como módulo, para que Node y los empaquetadores lo resuelvan.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const esmDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'esm');

function resolveSpecifier(fileDir, specifier) {
  if (specifier.endsWith('.js')) return specifier;
  const target = resolve(fileDir, specifier);
  if (existsSync(`${target}.js`)) return `${specifier}.js`;
  if (existsSync(join(target, 'index.js'))) return `${specifier}/index.js`;
  return `${specifier}.js`;
}

async function walk(dir) {
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!path.endsWith('.js')) continue;

    const source = await readFile(path, 'utf-8');
    const patched = source.replace(
      /((?:from|import)\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${resolveSpecifier(dirname(path), specifier)}${suffix}`,
    );
    if (patched !== source) await writeFile(path, patched);
  }
}

await walk(esmDir);
await writeFile(join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));
