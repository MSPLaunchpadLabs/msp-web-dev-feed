#!/usr/bin/env bash

set -e

for file in raw/*; do
  [ -f "$file" ] || continue

  name=$(basename "$file")
  out="outputs/$name.out.txt"

  echo "Processing: $name"

  {
    echo "=== PROCESSED FILE ==="
    echo "Source: $name"
    echo ""
    cat "$file"
    echo ""
    echo "Status: OK"
  } > "$out"

done

echo "Done."
