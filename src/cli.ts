import { parse } from "https://deno.land/std/flags/mod.ts";
import { buildAll, createDatabase } from "./build.ts";
import { getMarkdownFiles } from "./markdown.ts";

function usage() {
    console.log("Build markdown blog");
    console.log("usage: build.ts [DIR]");
    console.log("  [DIR]  Directory full of markdown files");
    Deno.exit(1);
}

// If --help or missing [DIR]
let args = parse(Deno.args);
if (args._.length != 1 || args.help) {
    usage();
}

// Directory of markdown files
let dir = args._[0] as string;
let articleFiles: string[] = [];

try {
    articleFiles = await getMarkdownFiles(dir);
} catch (e) {
    if (e instanceof Error) {
        if (e.name === "NotFound") {
            console.error("Directory does not exist: ", dir);
        }
    }
    Deno.exit(1);
}

const db = await createDatabase(articleFiles);

let completed = await buildAll(articleFiles);
Deno.exit(!completed ? 1 : 0);
