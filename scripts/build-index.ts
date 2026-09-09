/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";

interface IndexedFile {
  filePath: string;
  purpose: string;
  exports: string[];
  imports: string[];
}

interface FolderGroup {
  folder: string;
  files: IndexedFile[];
}

function getAllTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== "dist" && file !== "build") {
        getAllTsFiles(filePath, fileList);
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function parseFile(filePath: string, rootDir: string): IndexedFile {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Extract top JSDoc/comment for purpose
  let purpose = "";
  let commentBlock = false;
  const commentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("/**")) {
      commentBlock = true;
      continue;
    }
    if (commentBlock) {
      if (trimmed.endsWith("*/")) {
        commentBlock = false;
        if (commentLines.length > 0) {
          break;
        }
        continue;
      }
      const cleaned = trimmed.replace(/^\*\s?/, "").trim();
      if (cleaned && !cleaned.startsWith("@license") && !cleaned.startsWith("SPDX-License-Identifier")) {
        commentLines.push(cleaned);
      }
    } else if (trimmed.startsWith("//") && !trimmed.includes("@license") && !trimmed.includes("SPDX-License")) {
      commentLines.push(trimmed.replace(/^\/\/\s?/, "").trim());
    } else if (trimmed && !trimmed.startsWith("import") && !trimmed.startsWith("export")) {
      break;
    }
  }

  if (commentLines.length > 0) {
    purpose = commentLines.slice(0, 2).join(" ");
  }

  // Extract direct imports
  const imports: string[] = [];
  const importRegex = /import\s+.*?\s+from\s+["'](.*?)["']/g;
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    imports.push(importMatch[1]);
  }

  // Extract exports with signatures
  const exports: string[] = [];
  const exportRegex = /export\s+(interface|type|class|function|const|enum|let|var)\s+([A-Za-z0-9_$]+)(.*?)(?=\{|=|\n|;)/g;
  let exportMatch;
  while ((exportMatch = exportRegex.exec(content)) !== null) {
    const kind = exportMatch[1];
    const name = exportMatch[2];
    const rest = exportMatch[3].trim().slice(0, 60);
    exports.push(`${kind} ${name}${rest ? " " + rest : ""}`);
  }

  // Fallback purpose inference from exports
  if (!purpose) {
    if (exports.length > 0) {
      purpose = `Exports ${exports.slice(0, 3).map(e => e.split(" ")[1]).join(", ")}`;
    } else {
      purpose = "Module file";
    }
  }

  return {
    filePath: relativePath,
    purpose,
    exports: Array.from(new Set(exports)),
    imports: Array.from(new Set(imports)),
  };
}

function buildIndex() {
  const rootDir = process.cwd();
  const srcDir = path.join(rootDir, "src");

  if (!fs.existsSync(srcDir)) {
    console.error("src directory not found.");
    process.exit(1);
  }

  const tsFiles = getAllTsFiles(srcDir);
  const indexedFiles: IndexedFile[] = tsFiles.map((file) => parseFile(file, rootDir)).sort((a, b) => a.filePath.localeCompare(b.filePath));

  // Ensure docs directory exists
  const docsDir = path.join(rootDir, "docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Write JSON index
  const jsonPath = path.join(docsDir, "PROJECT_INDEX.json");
  fs.writeFileSync(jsonPath, JSON.stringify(indexedFiles, null, 2), "utf-8");

  // Group by folder for Markdown output
  const folderMap = new Map<string, IndexedFile[]>();
  for (const item of indexedFiles) {
    const folder = path.dirname(item.filePath);
    if (!folderMap.has(folder)) {
      folderMap.set(folder, []);
    }
    folderMap.get(folder)!.push(item);
  }

  let mdContent = `# Project Codebase Index\n\nAutomated compact index map of all modules, interfaces, and exports in \`src/\`.\n\n`;

  for (const [folder, files] of folderMap.entries()) {
    mdContent += `## Folder: \`${folder}\`\n\n`;
    for (const file of files) {
      mdContent += `### \`${path.basename(file.filePath)}\` (\`${file.filePath}\`)\n`;
      mdContent += `- **Purpose**: ${file.purpose}\n`;
      if (file.exports.length > 0) {
        mdContent += `- **Exports**: ${file.exports.map((e) => `\`${e}\``).join(", ")}\n`;
      }
      if (file.imports.length > 0) {
        mdContent += `- **Imports**: ${file.imports.map((i) => `\`${i}\``).join(", ")}\n`;
      }
      mdContent += `\n`;
    }
  }

  const mdPath = path.join(docsDir, "PROJECT_INDEX.md");
  fs.writeFileSync(mdPath, mdContent, "utf-8");

  console.log(`[build-index] Successfully indexed ${indexedFiles.length} files into docs/PROJECT_INDEX.json and docs/PROJECT_INDEX.md.`);
}

buildIndex();
