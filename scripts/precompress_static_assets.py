from pathlib import Path
import gzip


ROOT = Path(__file__).resolve().parents[1] / "public" / "static-site"
SUFFIXES = {".html", ".js", ".css", ".json", ".svg"}


for source in sorted(path for path in ROOT.rglob("*") if path.suffix in SUFFIXES):
    target = source.with_name(source.name + ".gz")
    with source.open("rb") as source_file, target.open("wb") as target_file:
        with gzip.GzipFile(
            filename="",
            mode="wb",
            fileobj=target_file,
            compresslevel=9,
            mtime=0,
        ) as output:
            output.write(source_file.read())
