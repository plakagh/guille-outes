#!/bin/sh
set -eu
awk '{for(k in ENVIRON){pat="\\$\\{"k"\\}"; gsub(pat,ENVIRON[k])}; print}' \
  /home/kong/temp.yml > /usr/local/kong/kong.yml
kong start
exec tail -f /dev/null
