# Icons

Place the following files here before running `pnpm package`:

| File         | Size     | Platform |
|--------------|----------|----------|
| `icon.icns`  | —        | macOS    |
| `icon.ico`   | 256×256  | Windows  |
| `icon.png`   | 512×512  | Linux    |

To generate from a single 1024×1024 PNG source:

```bash
# macOS: install imagemagick + libicns
brew install libicns imagemagick

# .icns
mkdir icon.iconset
for s in 16 32 64 128 256 512; do
  convert icon-source.png -resize ${s}x${s} icon.iconset/icon_${s}x${s}.png
done
iconutil -c icns icon.iconset

# .ico (Windows)
convert icon-source.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```
