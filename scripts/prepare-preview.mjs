import { copyFileSync, mkdirSync } from "node:fs";
const paths=["","records","records/projects","records/experiments","records/workflows","approach","examples/workflow"];
for(const path of paths){const dir="dist-preview"+(path?"/"+path:"");mkdirSync(dir,{recursive:true});copyFileSync("dist-preview/preview.html",dir+"/index.html");}
console.log("Path-based preview generated. Upload the entire dist-preview folder, including assets.");
