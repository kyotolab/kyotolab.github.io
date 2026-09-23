// 使い方: node scripts/staff-key.mjs
// 鍵は店（または京都ラボ）に渡し、ハッシュだけを wrangler secret に入れる。
import { createHash, randomBytes } from "node:crypto";

const key = randomBytes(24).toString("base64url");
const hash = createHash("sha256").update(key).digest("hex");
console.log(`key:  ${key}`);
console.log(`hash: ${hash}`);
