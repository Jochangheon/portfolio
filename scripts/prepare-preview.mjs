import { copyFileSync, mkdirSync } from "node:fs";
import { projects, projectPath } from "../src/portfolio.ts";
const paths=["","ai","career","projects",...projects.map(project => projectPath(project).slice(1)),"records","records/projects","records/experiments","records/workflows","approach","atlas","examples/workflow"];
for(const path of paths){const dir="dist-preview"+(path?"/"+path:"");mkdirSync(dir,{recursive:true});copyFileSync("dist-preview/preview.html",dir+"/index.html");}
console.log("Path-based preview generated. Upload the entire dist-preview folder, including assets.");
