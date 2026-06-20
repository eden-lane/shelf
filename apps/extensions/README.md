# Browser Extension

WXT extension for saving the active browser tab into the Bookmarks app.

## Development

Install dependencies from the repository root:

```sh
bun install
```

Run the extension in a browser:

```sh
bun --cwd apps/extensions run dev
```

Build the unpacked extension:

```sh
bun --cwd apps/extensions run build
```

The popup defaults to `http://localhost:3000` for the API. Change the API URL in
the popup when saving to a different self-hosted instance.
