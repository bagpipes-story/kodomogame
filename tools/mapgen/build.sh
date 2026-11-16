#!/bin/bash
# 地図の つみきの データを 作りなおす 開発用の 道具（アプリは これを つかわない）。
#   ./build.sh pref  … とどうふけん（js/games/balance/pref.js）
#   ./build.sh world … せかいのくに（js/games/balance/world.js）
# Natural Earth（パブリックドメイン）の 地図を 一時フォルダに ダウンロードして、絵と 当たり判定を 書き出す。
# 必要なもの: python3（shapely 2.1 いじょう）・curl
#   P=… で 見た目の 大きさの ちぢめかた（見た目の 大きさ ∝ 面積^P。ほんとうの 比は 0.5）を かえられる
set -e
cd "$(dirname "$0")"
PY=${PYTHON:-python3}
DATA=${MAP_DATA:-${TMPDIR:-/tmp}/kgb-mapgen}
mkdir -p "$DATA"
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
get() { [ -f "$DATA/$1.geojson" ] || curl -sSL -o "$DATA/$1.geojson" "$NE/$1.geojson"; }
get ne_10m_lakes
case "$1" in
  pref)
    get ne_10m_admin_1_states_provinces
    [ -f "$DATA/jp.geojson" ] || "$PY" -I -c "
import json, sys
d = json.load(open(sys.argv[1]))
json.dump({'type': 'FeatureCollection', 'features': [f for f in d['features'] if f['properties'].get('adm0_a3') == 'JPN']}, open(sys.argv[2], 'w'))
" "$DATA/ne_10m_admin_1_states_provinces.geojson" "$DATA/jp.geojson"
    "$PY" -B -E -s pref.py "$DATA/jp.geojson" "$DATA/ne_10m_lakes.geojson" "${P:-0.3}" "$DATA/pref.json"
    "$PY" -B -E -s emit.py "$DATA/pref.json" "$DATA/pref-data.js"
    cat head_pref.js "$DATA/pref-data.js" tail_pref.js > ../../js/games/balance/pref.js
    echo "wrote js/games/balance/pref.js" ;;
  world)
    get ne_10m_admin_0_countries_jpn # 日本から 見た 国境（北方領土は 日本）
    "$PY" -B -E -s world.py "$DATA/ne_10m_admin_0_countries_jpn.geojson" "$DATA/ne_10m_lakes.geojson" "${P:-0.28}" "$DATA/world.json"
    "$PY" -B -E -s emit.py "$DATA/world.json" "$DATA/world-data.js"
    cat head_world.js "$DATA/world-data.js" tail_world.js > ../../js/games/balance/world.js
    echo "wrote js/games/balance/world.js" ;;
  *) echo "usage: $0 pref|world"; exit 1 ;;
esac
