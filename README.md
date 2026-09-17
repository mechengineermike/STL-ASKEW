# ASKEW

ASKEW is a private-by-default, browser-based asymmetric STL scaling tool. Load a binary or ASCII STL, anchor one face, resize the opposite face, and export the result as a binary STL. Processing stays in the browser.

## Run locally

ES modules need an HTTP server. From this folder, run:

```powershell
python -m http.server 8080
```

Then open <http://localhost:8080>.

## Publish with GitHub Pages

1. Push `main` to GitHub.
2. Open the repository's **Settings -> Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`, then save.

The site will be available at `https://mechengineermike.github.io/STL-ASKEW/`. No build step or server is required.

## How the transform works

The selected face is the fixed plane and remains at 100% of its original size. Each cross-section is scaled in the two axes parallel to that face, reaching the selected percentage at the opposite side. Linear, ease-in, ease-out, and smooth transitions change how the scaling is distributed through the part.

STL files do not store units; ASKEW displays dimensions as millimeters because that is the common convention in 3D-printing workflows.
