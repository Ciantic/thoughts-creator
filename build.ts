import { markdown } from "./markdown.ts";

import { parse } from "https://deno.land/std/flags/mod.ts";
import { join, extname } from "https://deno.land/std/path/mod.ts";
import { recursiveReaddir } from "https://deno.land/x/recursive_readdir@v2.0.0/mod.ts";
import { gitLastEdit } from "./git.ts";

/**
 *
 * @param file
 */
async function build(file: string) {
    let contents = await Deno.readFile(file);
    let contents_str = new TextDecoder().decode(contents);
    let markdown_result = markdown(contents_str);
    let last_edited = await gitLastEdit(file);
    console.log("last_edited", last_edited);

    return markdown_result;
}

/**
 * Get all markdown files
 * @param dir
 */
async function getMarkdownFiles(dir: string) {
    return (await recursiveReaddir(dir)).filter((file) => extname(file) === ".md");
}

/**
 * Chunks an array in place (modifies the array)
 *
 * @param arr
 * @param size
 */
function chunkInplace<T>(arr: T[], size: number) {
    let result = [];
    while (arr.length) {
        result.push(arr.splice(0, size));
    }
    return result;
}

/**
 * Run worker like a function, once it reports anything back it's done.
 *
 * @param worker
 * @param initMessage
 */
async function runWorkerOnce<R>(worker: Worker, initMessage: any) {
    return new Promise<R>((resolve, reject) => {
        worker.postMessage(initMessage);
        worker.onmessage = (m) => {
            worker.terminate();
            const data = m.data as { success: R } | { error: any };
            // If success = undefined, then it's considered an error
            if ("success" in data) {
                resolve(data.success);
            } else {
                reject(data.error);
            }
        };
        worker.onerror = (m) => {
            worker.terminate();
            reject();
        };
        worker.onmessageerror = (m) => {
            worker.terminate();
            reject();
        };
    });
}

/**
 * Build all markdown files. Starts workers for each file.
 *
 * @param files Markdown files as list
 */
async function buildAll(files: string[]) {
    // Chunk the files by threads, and start workers for each file
    const number_of_threads = 16;
    const file_chunks = chunkInplace(files, number_of_threads);
    const failed_files: { file: string; reason: any }[] = [];

    for (const files of file_chunks) {
        // Wait for results
        let results = await Promise.allSettled(
            files.map((file) =>
                runWorkerOnce(
                    new Worker(new URL("build.ts", import.meta.url).href, {
                        type: "module",
                        deno: true,
                    }),
                    file
                )
            )
        );

        // Collect the results
        for (const [i, res] of results.entries()) {
            const file = files[i];
            if (res.status == "fulfilled") {
                // Succeeded
            } else if (res.status == "rejected") {
                failed_files.push({
                    file: file,
                    reason: res.reason,
                });
            }
        }
    }

    // Report results
    if (failed_files.length > 0) {
        console.error("Following files failed to build:");
        for (const file_error of failed_files) {
            console.error(`File: ${file_error.file}`);
            console.error(`Reason:`, file_error.reason);
            console.error("");
        }
        return false;
    } else {
        console.log("All files built.");
        return true;
    }
}

if ("onmessage" in self) {
    // Is worker instance of build.ts
    const worker = (self as any) as Worker & typeof self;
    worker.onmessage = async (e: MessageEvent) => {
        try {
            let result = await build("" + e.data);
            console.log("report", result);
            worker.postMessage({
                success: result,
            });
        } catch (e) {
            worker.postMessage({
                error: (e as Error).stack,
            });
        }
        worker.close();
    };
} else if (import.meta.main) {
    // Is cli instance of build.ts
    let args = parse(Deno.args);
    if (args._.length != 1) {
        console.error("usage: build.ts [DIR]");
    }
    let dir = args._[0] as string;
    let files: string[] = [];

    try {
        files = await getMarkdownFiles(dir);
    } catch (e) {
        if (e instanceof Error) {
            if (e.name === "NotFound") {
                console.error("Directory does not exist: ", dir);
            }
        }
        Deno.exit(1);
    }

    let completed = await buildAll(files);
    Deno.exit(!completed ? 1 : 0);
} else {
    console.log("???");
}

interface Unknown {
    _type: "Unknown";
    error: string;
}
