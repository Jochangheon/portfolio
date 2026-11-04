import { mkdirSync, copyFileSync } from "node:fs";
mkdirSync("site", { recursive: true });
copyFileSync("dist-preview/index.html", "site/index.html");
console.log(
  "site/index.html is ready to upload to a separate public web directory.",
);
