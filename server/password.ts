import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export function hashPassword(password: string) {
 const salt=randomBytes(16).toString("hex");
 return salt+":"+scryptSync(password,salt,64).toString("hex");
}
export function verifyPassword(password: unknown, encoded: string) {
 if(typeof password!=="string" || password.length<12 || password.length>256) return false;
 if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded))return false;
 const [salt,hash]=encoded.split(":");
 return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hash,"hex"));
}
