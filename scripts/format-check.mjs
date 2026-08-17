import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const roots = ["src", "scripts", "tests"];
const files = roots.flatMap((root) => readdirSync(root, { recursive: true })
  .filter((entry) => typeof entry === "string" && /\.(?:ts|mjs)$/.test(entry))
  .map((entry) => join(root, entry)));
const problems = files.filter((file) => {
  const content = readFileSync(file, "utf8");
  return !content.endsWith("\n") || /[ \t]+$/m.test(content);
});

if (problems.length > 0) {
  console.error(`Formatting issues: ${problems.join(", ")}`);
  process.exit(1);
}

console.log(`Formatting check passed for ${files.length} files.`);
