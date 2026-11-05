import { cpSync, mkdirSync } from "node:fs";
mkdirSync("site",{recursive:true});cpSync("dist-preview","site",{recursive:true});
console.log("Upload the entire site/ directory. index.html alone is not a deployable app.");
