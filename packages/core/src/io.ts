import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";

export async function readYamlFile<T>(path: string): Promise<T> {
  const text = await readFile(path, "utf8");
  return parse(text) as T;
}

export async function writeYamlFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const text = stringify(value, {
    lineWidth: 100,
    singleQuote: false,
    defaultStringType: "PLAIN",
  });
  await writeFile(path, text, "utf8");
}

export async function writeTextFile(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}
