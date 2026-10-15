"""Extract public motorway topology from Geofabrik's South Korea OSM PBF.

Requires `pip install osmium`. Usage:
  python scripts/build-highway-data.py south-korea.osm.pbf intermediate.json
  node scripts/compact-highway-data.mjs intermediate.json
Only public road data is processed; no facility packs or GPS data are read.
"""
import collections
import json
import sys
import osmium

ROADS = {'수도권제1순환고속도로', '경부고속도로', '중부고속도로', '제2중부고속도로', '영동고속도로'}

class Ways(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ways = []
        self.ids = set()
        self.names = collections.Counter()

    def way(self, w):
        tags = dict(w.tags)
        kind = tags.get('highway')
        if kind == 'motorway' and tags.get('name') in ROADS or kind == 'motorway_link':
            ids = [n.ref for n in w.nodes]
            self.ids.update(ids)
            self.ways.append({'type': 'way', 'id': w.id, 'nodes': ids, 'tags': tags})
            if kind == 'motorway':
                self.names[tags['name']] += 1

class Nodes(osmium.SimpleHandler):
    def __init__(self, ids):
        super().__init__()
        self.ids = ids
        self.nodes = []

    def node(self, n):
        if n.id in self.ids and n.location.valid():
            self.nodes.append({'type': 'node', 'id': n.id, 'lat': n.location.lat, 'lon': n.location.lon})

ways = Ways()
ways.apply_file(sys.argv[1])
print(json.dumps(dict(ways.names), ensure_ascii=False), flush=True)
if set(ways.names) != ROADS:
    raise RuntimeError('Missing allowed motorway names: ' + str(ROADS-set(ways.names)))
nodes = Nodes(ways.ids)
nodes.apply_file(sys.argv[1])
reader = osmium.io.Reader(sys.argv[1])
data_as_of = reader.header().get('osmosis_replication_timestamp')
reader.close()
with open(sys.argv[2], 'w', encoding='utf-8') as output:
    json.dump({'source': 'OpenStreetMap / Geofabrik South Korea', 'dataAsOf': data_as_of, 'elements': ways.ways+nodes.nodes}, output, ensure_ascii=False, separators=(',', ':'))
print(f'Saved {len(ways.ways)} ways, {len(nodes.nodes)} nodes', flush=True)
