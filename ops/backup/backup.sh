#!/usr/bin/env bash
# Copia cifrada de la base de datos (formato personalizado de pg_dump + AES-256 con gpg).
#
# Variables:
#   SOURCE_DATABASE_URL  conexión a la BD que se copia (se acepta postgresql+psycopg://)
#   BACKUP_PASSPHRASE    clave de cifrado; sin ella la copia no se puede abrir
#   OUT_DIR              carpeta de salida (por defecto, la actual)
#
# Requiere pg_dump 17 y gpg: vienen en la imagen oficial postgres:17.
# Nunca imprime la URL ni la clave. Ver docs/operacion/copias-de-seguridad.md.
set -euo pipefail

: "${SOURCE_DATABASE_URL:?Falta SOURCE_DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"
OUT_DIR="${OUT_DIR:-.}"

url="${SOURCE_DATABASE_URL/postgresql+psycopg:/postgresql:}"
stamp="$(date -u +%Y%m%d-%H%M%S)"
plain="$(mktemp)"
target="${OUT_DIR}/aroma-db-${stamp}.dump.gpg"
trap 'rm -f "$plain"' EXIT

mkdir -p "$OUT_DIR"
pg_dump --format=custom --no-owner --no-privileges --dbname="$url" --file="$plain"

# La clave entra por un descriptor de archivo: no aparece en la lista de procesos
gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 \
    --passphrase-fd 3 --output "$target" "$plain" 3<<<"$BACKUP_PASSPHRASE"

size="$(du -h "$target" | cut -f1)"
sum="$(sha256sum "$target" | cut -d' ' -f1)"
echo "Copia cifrada: $target ($size, sha256 $sum)"
