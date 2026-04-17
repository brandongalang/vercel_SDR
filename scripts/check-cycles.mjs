#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const DEFAULT_ROOTS = ["app", "components", "lib", "workflows"];
const FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const INDEX_BASENAMES = FILE_EXTENSIONS.map((extension) => `index${extension}`);
const cwd = process.cwd();

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function isSourceFile(name) {
  return FILE_EXTENSIONS.some((extension) => name.endsWith(extension)) && !name.endsWith(".d.ts");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && isSourceFile(entry.name)) {
      files.push(normalizePath(fullPath));
    }
  }

  return files;
}

function resolveLocalSpecifier(fromFile, specifier, fileSet) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("@/")) {
    return null;
  }

  const basePath = specifier.startsWith("@/")
    ? path.join(cwd, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);

  const candidates = [
    basePath,
    ...FILE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...INDEX_BASENAMES.map((basename) => path.join(basePath, basename)),
  ].map(normalizePath);

  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function tarjan(graph) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowlinks = new Map();
  const stronglyConnectedComponents = [];

  function strongConnect(node) {
    indices.set(node, index);
    lowlinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const dependency of graph.get(node) ?? []) {
      if (!indices.has(dependency)) {
        strongConnect(dependency);
        lowlinks.set(node, Math.min(lowlinks.get(node), lowlinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowlinks.set(node, Math.min(lowlinks.get(node), indices.get(dependency)));
      }
    }

    if (lowlinks.get(node) === indices.get(node)) {
      const component = [];
      let currentNode;

      do {
        currentNode = stack.pop();
        onStack.delete(currentNode);
        component.push(currentNode);
      } while (currentNode !== node);

      stronglyConnectedComponents.push(component);
    }
  }

  for (const node of graph.keys()) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }

  return stronglyConnectedComponents;
}

async function main() {
  const roots = process.argv.slice(2);
  const searchRoots = roots.length > 0 ? roots : DEFAULT_ROOTS;
  const files = (
    await Promise.all(
      searchRoots.map(async (root) => {
        const rootPath = path.resolve(cwd, root);
        const stats = await fs.stat(rootPath);
        return stats.isDirectory() ? walk(rootPath) : [normalizePath(rootPath)];
      }),
    )
  ).flat();
  const fileSet = new Set(files);
  const graph = new Map();

  for (const file of files) {
    const sourceText = await fs.readFile(file, "utf8");
    const { importedFiles } = ts.preProcessFile(sourceText, true, true);
    const dependencies = new Set();

    for (const importedFile of importedFiles) {
      const resolved = resolveLocalSpecifier(file, importedFile.fileName, fileSet);
      if (resolved) {
        dependencies.add(resolved);
      }
    }

    graph.set(file, [...dependencies]);
  }

  const cycles = tarjan(graph).filter((component) => component.length > 1);

  if (cycles.length === 0) {
    const edgeCount = [...graph.values()].reduce((total, dependencies) => total + dependencies.length, 0);
    console.log(
      `No circular local imports found across ${files.length} files and ${edgeCount} dependency edges.`,
    );
    return;
  }

  console.error(`Found ${cycles.length} circular import group${cycles.length === 1 ? "" : "s"}:`);
  for (const cycle of cycles) {
    const relativeCycle = cycle
      .map((file) => normalizePath(path.relative(cwd, file)))
      .sort((left, right) => left.localeCompare(right));
    console.error(`- ${relativeCycle.join(" -> ")}`);
  }

  process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
