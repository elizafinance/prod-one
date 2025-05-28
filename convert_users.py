import re
import json
import sys
from pathlib import Path

"""convert_users.py
--------------------------------------------------
Usage::
    python convert_users.py <infile> [<outfile>]

This script fixes the malformed Twitter-user dump you pasted earlier and
produces proper Extended-JSON that mongoimport understands.

Fixes applied line-by-line:
1. Removes Atlas shell chatter (lines that start with `Atlas`, `Type "it"`, etc.).
2. Strips the extra quote wrapper each property line had.
3. Transforms key/value pairs like::
        xUserId: '1877366139547684864',
   into valid JSON::
        "xUserId": "1877366139547684864",
4. Replaces single-quoted string literals inside arrays.
5. Converts shell dates ``ISODate('2025-05-12T09:05:30.032Z')`` into
   Extended-JSON:: ``{"$date":"2025-05-12T09:05:30.032Z"}``.
6. Removes trailing commas immediately before a closing ``]`` or ``}``.

If the resulting payload still fails to parse as JSON the script aborts and
prints the first parsing error with the line snippet to help you tweak the
regexes.

--------------------------------------------------
"""

ISO_RE = re.compile(r"ISODate\(\s*'([^']+)'\s*\)")
# key: 'value'    OR   key: "value"
KV_RE = re.compile(r"([A-Za-z0-9_]+):\s*'([^']*)'")
SINGLE_QUOTED_STR_RE = re.compile(r"'([^']+)'")
TRAILING_COMMA_RE = re.compile(r",\s*([}\]])")


def preprocess_line(raw: str) -> str:
    """Apply regex fixes to a single line."""
    line = raw.rstrip("\n")

    # Remove shell output noise straight away
    if line.startswith("Atlas ") or line.startswith("Type \"it\""):
        return ""

    # Many property lines were wrapped in double quotes to form a string literal.
    if line.startswith("\"") and line.endswith("\","):
        line = line[1:-2] + ","  # keep the comma
    elif line.startswith("\"") and line.endswith("\""):
        line = line[1:-1]

    # Fix ISODate -> Extended JSON
    line = ISO_RE.sub(r'{"$date":"\1"}', line)

    # key: 'value'  ->  "key": "value"
    line = KV_RE.sub(r'"\1": "\2"', line)

    # Replace any remaining single-quoted literals (array items)
    line = SINGLE_QUOTED_STR_RE.sub(r'"\1"', line)

    return line


def main(in_path: Path, out_path: Path):
    processed_lines = []

    with in_path.open(encoding="utf8") as f:
        for raw in f:
            fixed = preprocess_line(raw)
            if fixed.strip():
                processed_lines.append(fixed)

    blob = "\n".join(processed_lines)

    # Remove trailing commas before ] or } that JSON doesn't allow.
    blob = TRAILING_COMMA_RE.sub(r"\1", blob)

    # Validate JSON – will raise if still broken.
    try:
        parsed = json.loads(blob)
    except json.JSONDecodeError as exc:
        print("✖ JSON still invalid:", exc)
        # Give a little context to help debugging
        bad_line = blob.split("\n")[exc.lineno - 1]
        print(f"Problematic line {exc.lineno}: {bad_line[:120]}")
        sys.exit(1)

    # Write out the pretty-printed clean version
    out_path.write_text(json.dumps(parsed, indent=2), encoding="utf8")
    print(f"✅ Clean JSON written to {out_path}  (documents: {len(parsed)})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python convert_users.py <infile> [<outfile>]")
        sys.exit(1)

    in_file = Path(sys.argv[1])
    if not in_file.exists():
        print(f"Input file '{in_file}' not found")
        sys.exit(1)

    out_file = Path(sys.argv[2]) if len(sys.argv) > 2 else in_file.with_name("users_clean.json")
    main(in_file, out_file) 