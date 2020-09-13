import { parse } from "https://deno.land/std/flags/mod.ts";
import { generate, createDatabase } from "./build.ts";
import { getRecursivelyFilesWithExt } from "./fs.ts";

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

// Article files
const articleFiles = await getRecursivelyFilesWithExt(dir, "md");
const db = await createDatabase(".cache.db");
const { failed_files } = await generate(db, articleFiles, ".out");

// Report results
if (failed_files.length > 0) {
    console.error("Following files failed to build:");
    for (const file_error of failed_files) {
        console.error(`File: ${file_error.file}`);
        console.error(`Reason:`, file_error.reason);
        console.error("");
    }
    Deno.exit(1);
} else {
    console.log("All files built.");
    Deno.exit(0);
}

// let completed = await generate(db, ".out");
// Deno.exit(!completed ? 1 : 0);
