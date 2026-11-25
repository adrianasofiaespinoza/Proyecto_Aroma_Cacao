# Copias de seguridad de la BD

**Política (decisión de la usuaria, 2026-11-25):** una copia diaria, guardada 30 días.

## Cómo funciona

- El flujo `.github/workflows/backup.yml` corre todos los días a las 07:00 UTC (02:00 en Ecuador). También se puede lanzar a mano: **Actions → Copia diaria de la BD → Run workflow**.
- Ejecuta `ops/backup/backup.sh` dentro de la imagen oficial `postgres:17`, que trae `pg_dump` y `gpg`.
- La copia se hace con `pg_dump --format=custom` y se **cifra con AES-256** (`gpg --symmetric`). El repositorio es **público**: cualquier persona con cuenta de GitHub puede descargar los archivos guardados por Actions, así que **sin cifrar no se puede guardar ahí**.
- El archivo cifrado se guarda como artefacto del flujo durante **30 días**. Queda fuera del servidor de la BD.
- Si faltan los secretos, el flujo termina con un aviso y no hace la copia.

## Configurar (una vez por instalación)

En GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Secreto | Valor |
|---|---|
| `PROD_DATABASE_URL` | La URL externa de la BD de producción. En Render: *Connect → External*, con `?sslmode=require` al final. |
| `BACKUP_PASSPHRASE` | Una clave larga y aleatoria (por ejemplo, `python -c "import secrets; print(secrets.token_urlsafe(32))"`). **Guárdala también en un gestor de contraseñas:** si se pierde, ninguna copia se puede abrir. |

Después, lanza el flujo a mano una vez y comprueba que termine en verde y que aparezca el artefacto `aroma-db-…`.

Los secretos no se escriben en el repositorio ni se pasan a la IA.

## Restaurar

Siempre en una **BD nueva y vacía**. El script se niega a restaurar encima de una BD que tenga tablas.

1. Descarga la copia, desde la página del flujo en **Actions** o con:
   ```fish
   gh run list --workflow backup.yml --limit 5
   gh run download <id> --dir ~/restauracion
   ```
2. Crea una BD vacía. En local:
   ```fish
   docker exec aroma-postgres createdb -U aroma_user aroma_restaurada
   ```
3. Restaura con el script, dentro del contenedor (trae `pg_restore` y `gpg`):
   ```fish
   docker cp ~/restauracion/aroma-db-*/aroma-db-*.dump.gpg aroma-postgres:/tmp/copia.dump.gpg
   docker cp ops/backup/restore.sh aroma-postgres:/tmp/restore.sh
   docker exec -it -e TARGET_DATABASE_URL="postgresql:///aroma_restaurada?user=aroma_user" aroma-postgres bash /tmp/restore.sh /tmp/copia.dump.gpg
   ```
   `gpg` pide la clave de cifrado. Al terminar, el script muestra las filas de cada tabla.
4. Revisa los datos y, si son los correctos, apunta `DATABASE_URL` a la BD restaurada o cópiala al servidor de producción.
5. Borra el archivo descifrado y las copias locales cuando ya no las necesites:
   ```fish
   docker exec aroma-postgres rm -f /tmp/copia.dump.gpg /tmp/restore.sh
   ```

Para restaurar en el hosting, se usa la misma `TARGET_DATABASE_URL` de una BD nueva creada allí, desde cualquier máquina con la imagen `postgres:17`:
```fish
docker run --rm -it -v $PWD:/w -e TARGET_DATABASE_URL='<url de la BD nueva>' postgres:17 bash /w/ops/backup/restore.sh /w/copia.dump.gpg
```

## Prueba de restauración

**2026-11-25:** copia cifrada de la BD local `aroma_inventory`, restaurada en una BD aparte. Resultado:

- Las 20 tablas tienen las mismas filas que la original (comparadas una por una).
- Con una clave incorrecta, el archivo no se abre (`Bad session key`).
- El archivo cifrado no contiene la cabecera `PGDMP` de `pg_dump`, así que no se puede leer sin la clave.
- Una segunda restauración encima de la misma BD se rechaza.

Repetir esta prueba después de cambiar de hosting y, como mínimo, una vez por semestre.
