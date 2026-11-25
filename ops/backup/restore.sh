#!/usr/bin/env bash
# Restaura una copia cifrada en una BD VACÍA (nunca encima de una con datos).
#
# Uso:  restore.sh aroma-db-AAAAMMDD-HHMMSS.dump.gpg
# Variables:
#   TARGET_DATABASE_URL  BD de destino, que debe existir y estar vacía
#   BACKUP_PASSPHRASE    la misma clave con la que se cifró (si falta, gpg la pide)
#
# Requiere pg_restore 17, psql y gpg (imagen postgres:17). Ver docs/operacion/copias-de-seguridad.md.
set -euo pipefail

file="${1:?Uso: restore.sh archivo.dump.gpg}"
: "${TARGET_DATABASE_URL:?Falta TARGET_DATABASE_URL}"
url="${TARGET_DATABASE_URL/postgresql+psycopg:/postgresql:}"

# Protección: solo en una BD sin tablas, para no pisar producción por error
tables="$(psql "$url" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")"
if [ "$tables" != "0" ]; then
  echo "La BD de destino tiene $tables tablas. Restaura en una BD nueva y vacía." >&2
  exit 1
fi

plain="$(mktemp)"
trap 'rm -f "$plain"' EXIT
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
      --output "$plain" --decrypt "$file" 3<<<"$BACKUP_PASSPHRASE"
else
  gpg --yes --quiet --output "$plain" --decrypt "$file"
fi

pg_restore --no-owner --no-privileges --exit-on-error --dbname="$url" "$plain"

echo "Restaurada. Filas por tabla:"
psql "$url" -c "select table_name as tabla,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int as filas
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"
