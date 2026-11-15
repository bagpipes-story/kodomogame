import json, sys
D = json.load(open(sys.argv[1]))

def num(v):
    s = f"{v:.1f}"
    if s.endswith('.0'):
        s = s[:-2]
    if s == '-0':
        s = '0'
    return s.replace('0.', '.', 1) if s.startswith('0.') else s.replace('-0.', '-.', 1)

def flat(ring):
    return '[' + ','.join(num(c) for p in ring for c in p) + ']'

lines = []
for pid, o in D.items():
    rings = '[' + ','.join(flat(r) for r in o['draw']) + ']'
    parts = '[' + ','.join(flat(r) for r in o['parts']) + ']'
    lake = (',' + flat(o['lake'])) if o.get('lake') else ''
    lines.append(f"  {pid}: ['{o['region']}', {o['pad']}, {rings}, {parts}{lake}],")
open(sys.argv[2], 'w').write('\n'.join(lines) + '\n')
