import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const domainRoot = process.argv[2] ?? "src/domain";
const importFrom = /from\s+["']([^"']+)["']/g;
const forbiddenLayer = /(?:^|[/@])(web|server|storage)(?:$|\/)/;
const files = existsSync(domainRoot)
  ? readdirSync(domainRoot, { recursive: true }).filter((entry) => String(entry).endsWith(".ts")).map((entry) => join(domainRoot, entry))
  : [];
if (files.length === 0) {
  console.error(`Architecture check requires at least one domain TypeScript file in ${domainRoot}.`);
  process.exit(1);
}
const violations = files.filter((file) => {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(importFrom)].some((match) => forbiddenLayer.test(match[1]));
});

if (violations.length > 0) {
  console.error(`Domain boundary violations: ${violations.join(", ")}`);
  process.exit(1);
}

console.log(`Architecture check passed for ${files.length} domain files.`);
