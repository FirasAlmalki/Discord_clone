import { mkdir, copyFile, rm } from "node:fs/promises";

const output = "dist";
const files = ["index.html", "app.js", "styles.css"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await copyFile(file, `${output}/${file}`);
}

console.log("Built static app in dist/");
