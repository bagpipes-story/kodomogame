#!/bin/bash
# とどうふけん つみき（js/games/balance/pref.js）を 作りなおす 開発用の 道具（アプリは これを つかわない）。
# Natural Earth（パブリックドメイン）の 地図を 一時フォルダに ダウンロードして、47都道府県の 絵と 当たり判定を 書き出す。
# 必要なもの: python3（shapely 2.1 いじょう）・curl
#   P=0.3 … 見た目の 大きさ ∝ 面積^P（ほんとうの 比は 0.5。小さい 県が 見えなく ならない ように ちぢめている）
set -e
cd "$(dirname "$0")"
PY=${PYTHON:-python3}
DATA=${PREF_DATA:-${TMPDIR:-/tmp}/kgb-prefgen}
mkdir -p "$DATA"
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
[ -f "$DATA/adm1.geojson" ] || curl -sSL -o "$DATA/adm1.geojson" "$NE/ne_10m_admin_1_states_provinces.geojson"
[ -f "$DATA/lakes.geojson" ] || curl -sSL -o "$DATA/lakes.geojson" "$NE/ne_10m_lakes.geojson"
[ -f "$DATA/jp.geojson" ] || "$PY" -I -c "
import json, sys
d = json.load(open(sys.argv[1]))
json.dump({'type': 'FeatureCollection', 'features': [f for f in d['features'] if f['properties'].get('adm0_a3') == 'JPN']}, open(sys.argv[2], 'w'))
" "$DATA/adm1.geojson" "$DATA/jp.geojson"
"$PY" -I gen.py "$DATA/jp.geojson" "$DATA/lakes.geojson" "${P:-0.3}" "$DATA/pref.json"
"$PY" -I emit.py "$DATA/pref.json" "$DATA/data.js"
cat head.js "$DATA/data.js" foot.js > ../../js/games/balance/pref.js
echo "wrote js/games/balance/pref.js"
