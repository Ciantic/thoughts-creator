import { parse } from "https://deno.land/std/flags/mod.ts";
import docopt, { DocOptions } from "https://deno.land/x/docopt@v1.0.1/src/docopt.ts";
import { generate, createDatabase } from "./build.ts";
import { getRecursivelyFilesWithExt } from "./utils/fs.ts";

const doc = `
Build markdown blog 0.0.1

Usage:
  ${import.meta.url} [options]

Options:
  -h --help             Show this screen.
  --articles=<dir>      Article directory [default: articles]
  --root=<dir>          Root directory. [Default: root]
  --out=<dir>           Output directory. [Default: out]
  --clean-out           Clean output directory after build.
`;
let opts: {
    "--help": boolean;
    "--articles": string;
    "--root": string;
    "--out": string;
    "--clean-out": boolean;
};

try {
    opts = docopt(doc) as any;
} catch (e) {
    console.error(e.message);
    Deno.exit(1);
}

async function main() {
    // Article files
    const db = await createDatabase(".cache.db");
    const { failedArticles, failedResources } = await generate({
        db,
        articleDir: opts["--articles"],
        outputDir: opts["--out"],
        rootDir: opts["--root"],
        removeExtraOutputFiles: opts["--clean-out"] === true,
    });

    // Report results
    if (failedArticles.length > 0) {
        console.error("Following files failed to build:");
        for (const file of failedArticles) {
            console.error(`File: ${file}`);
            console.error("");
        }
        Deno.exit(1);
    } else {
        console.log("All files built.");
        Deno.exit(0);
    }
}

await main();
