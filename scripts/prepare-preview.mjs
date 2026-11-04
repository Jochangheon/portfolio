import { copyFileSync } from "node:fs";
copyFileSync("dist-preview/preview.html", "dist-preview/index.html");
console.log(
  "Interactive frontend ready in dist-preview; npm run preview serves it on port 4173.",
);
