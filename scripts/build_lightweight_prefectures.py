import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "static-site" / "data" / "china-prefectures.json"
TARGET_DIR = ROOT / "public" / "static-site" / "data"
CHUNK_COUNT = 8
TOLERANCE = 0.08
MIN_POLYGON_AREA = 0.005


def point_segment_distance_squared(point, start, end):
    x, y = point
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return (x - x1) ** 2 + (y - y1) ** 2
    ratio = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return (x - (x1 + ratio * dx)) ** 2 + (y - (y1 + ratio * dy)) ** 2


def simplify_line(points, tolerance):
    if len(points) <= 2:
        return points
    max_distance = 0
    split_index = 0
    for index in range(1, len(points) - 1):
        distance = point_segment_distance_squared(points[index], points[0], points[-1])
        if distance > max_distance:
            max_distance = distance
            split_index = index
    if max_distance <= tolerance * tolerance:
        return [points[0], points[-1]]
    before = simplify_line(points[: split_index + 1], tolerance)
    after = simplify_line(points[split_index:], tolerance)
    return before[:-1] + after


def ring_area(ring):
    return abs(
        sum(
            ring[index][0] * ring[(index + 1) % len(ring)][1]
            - ring[(index + 1) % len(ring)][0] * ring[index][1]
            for index in range(len(ring))
        )
        / 2
    )


def simplify_ring(ring):
    points = ring[:-1] if ring and ring[0] == ring[-1] else ring
    if len(points) < 3:
        return ring
    center_x = sum(point[0] for point in points) / len(points)
    center_y = sum(point[1] for point in points) / len(points)
    start_index = max(
        range(len(points)),
        key=lambda index: (points[index][0] - center_x) ** 2 + (points[index][1] - center_y) ** 2,
    )
    rotated = points[start_index:] + points[:start_index] + [points[start_index]]
    simplified = simplify_line(rotated, TOLERANCE)
    if len(simplified) < 4:
        simplified = rotated
    return [[round(x, 3), round(y, 3)] for x, y in simplified]


def simplify_geometry(geometry):
    if geometry["type"] == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [simplify_ring(geometry["coordinates"][0])],
        }

    polygons = [
        [simplify_ring(polygon[0])]
        for polygon in geometry["coordinates"]
        if ring_area(polygon[0]) >= MIN_POLYGON_AREA
    ]
    if not polygons:
        largest = max(geometry["coordinates"], key=lambda polygon: ring_area(polygon[0]))
        polygons = [[simplify_ring(largest[0])]]
    return {"type": "MultiPolygon", "coordinates": polygons}


def main():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    features = [
        {
            "type": "Feature",
            "properties": feature["properties"],
            "geometry": simplify_geometry(feature["geometry"]),
        }
        for feature in source["features"]
    ]
    chunks = [[] for _ in range(CHUNK_COUNT)]
    chunk_sizes = [0] * CHUNK_COUNT
    for feature in sorted(
        features,
        key=lambda item: len(json.dumps(item, ensure_ascii=False, separators=(",", ":"))),
        reverse=True,
    ):
        target_index = min(range(CHUNK_COUNT), key=lambda index: chunk_sizes[index])
        chunks[target_index].append(feature)
        chunk_sizes[target_index] += len(
            json.dumps(feature, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        )

    old_target = TARGET_DIR / "china-prefectures-lite.json"
    old_target.unlink(missing_ok=True)
    targets = []
    for index, chunk in enumerate(chunks, start=1):
        target = TARGET_DIR / f"china-prefectures-lite-{index}.json"
        target.write_text(
            json.dumps(
                {"type": "FeatureCollection", "features": chunk},
                ensure_ascii=False,
                separators=(",", ":"),
            )
            + "\n",
            encoding="utf-8",
        )
        targets.append(target)
    print(
        json.dumps(
            {
                "features": len(features),
                "chunks": len(targets),
                "largestBytes": max(target.stat().st_size for target in targets),
                "targets": [str(target.relative_to(ROOT)) for target in targets],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
