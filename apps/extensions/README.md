# Browser Extension

WXT extension for saving the active browser tab into Shelf.

## Development

Install dependencies from the repository root:

```sh
bun install
```

Run the extension in a browser:

```sh
cd apps/extensions
bun run dev
```

Build the unpacked extension:

```sh
cd apps/extensions
bun run build
```

Build the Safari Web Extension and generate the macOS Xcode wrapper:

```sh
cd apps/extensions
bun run build:safari
```

This writes WXT's Safari web-extension output to `.output/safari-mv2`, stages a
converter-friendly copy at `safari-web-extension`, and creates the local Xcode
project at `safari-extension/Shelf/Shelf.xcodeproj`.

The popup defaults to `http://localhost:3000` for the API. Change the API URL in
the popup when saving to a different self-hosted instance.
