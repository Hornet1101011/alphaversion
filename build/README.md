# Client packaging output

This folder will contain the client packaging artifacts after running the repository root script `package-client.ps1`.

What the script does:

- Runs `npm install` and `npm run build` in the `client` folder.
- Copies the `client/build` contents to `build/client`.
- Copies `client/package.json` and `client/public` (if present) into `build/client` for reference.
- Creates a zip file `build/client-build.zip` ready for upload to Hostinger.

How to run:

From the repository root (PowerShell):

```powershell
.\package-client.ps1
```

If PowerShell blocks the script due to execution policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\package-client.ps1
```

After success you will find:

- `build/client/` — the static files to upload (index.html, static/js, static/css, etc.)
- `build/client-build.zip` — zipped package ready for transfer
