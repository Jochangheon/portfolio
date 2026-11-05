import {randomBytes} from "node:crypto";
import {writeFileSync,existsSync} from "node:fs";
import {hashPassword} from "../server/password.ts";
const dir="/etc/portfolio-ai-records";
if(existsSync(dir+"/app.env")){console.log("Existing administrator configuration preserved.");process.exit(0);}
const password=randomBytes(24).toString("base64url");
writeFileSync(dir+"/initial-password",password+"\n",{mode:0o600,flag:"wx"});
writeFileSync(dir+"/app.env",[
 "NODE_ENV=production","HOST=127.0.0.1","PORT=3120",
 "APP_URL=https://portfolio.49.247.40.177.sslip.io",
 "DATA_DIR=/srv/portfolio-ai-records/data",
 "ADMIN_GITHUB_ID=88309559","ADMIN_PASSWORD_HASH="+hashPassword(password),""
].join("\n"),{mode:0o600,flag:"wx"});
console.log("Administrator configured; initial password stored in protected server file.");
