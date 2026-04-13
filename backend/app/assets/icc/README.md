# ICC Profiles

Place the FOGRA39 ICC profile here as `FOGRA39L.icc` for accurate CMYK conversion.

Download from: https://www.eci.org/en/downloads.html (ECI Offset 2009 / FOGRA39)

Without this file, the system falls back to Pillow's basic CMYK conversion, which is acceptable
for proofing but not ideal for commercial print.

Singapore print houses commonly accept FOGRA39 (European Coated) — confirm with your print house before production.
