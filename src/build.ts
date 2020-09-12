import { markdown } from "./markdown.ts";

import { parse } from "https://deno.land/std/flags/mod.ts";
import { join, extname } from "https://deno.land/std/path/mod.ts";
import { gitLastEdit, gitCreated } from "./git.ts";
// import { layout } from "./layout.tsx";
import { DbContext } from "./db.ts";

/**
 * Create database
 *
 * @param articleFiles
 */
export async function createDatabase(databaseFile: string, articleFiles: string[]) {
    const db = new DbContext(databaseFile);
    const result = db.createSchema();
    if (result.error) {
        throw new Error("Database creation failed");
    }

    const dbMaxDate = db.getArticleMaxModifiedOnDisk();
    const maxDate = dbMaxDate.result;

    const foundFiles = [];
    for (const articleFile of articleFiles) {
        const file = await Deno.realPath(articleFile);
        const stat = await Deno.lstat(articleFile);
        if (!stat.mtime) {
            throw new Error("Mtime not fetched for " + file);
        }

        // If the file is newer than in the database, add or update it
        if (!maxDate || stat.mtime > maxDate) {
            const created = await gitCreated(file);
            const modified = await gitLastEdit(file);
            db.addArticle({
                created: created,
                file: file,
                hash: "",
                modified: modified,
                modified_on_disk: stat.mtime,
            });
        }
        foundFiles.push(file);
    }

    db.cleanOldArticles(foundFiles);

    return db;
}

/**
 *
 * @param file
 */
async function build(file: string) {
    let file_info = await Deno.lstat(file);
    let contents = await Deno.readFile(file);
    let contents_str = new TextDecoder().decode(contents);
    let markdown_result = markdown(contents_str);
    if (!file_info.mtime) {
        throw new Error("Modification date is missing");
    }

    // if (!hasArticle(file, file_info.mtime)) {
    //     let edited = await gitLastEdit(file);
    //     let created = await gitCreated(file);

    //     addArticle({
    //         created: created,
    //         file: file,
    //         hash: "",
    //         id: 0,
    //         modified: edited,
    //         modified_on_disk: file_info.mtime,
    //     });
    // }

    return {
        build: "cache",
    };

    // return layout({
    //     created: created,
    //     lastEdited: edited,
    //     html: markdown_result.body,
    //     // link: new URL(""),
    //     title: "",
    // });

    // return markdown_result;
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
export async function buildAll(db: DbContext) {
    // Chunk the files by threads, and start workers for each file
    const number_of_threads = 16;
    const files: string[] = []; // TODO: ...
    const file_chunks = chunkInplace(files, number_of_threads);
    const failed_files: { file: string; reason: any }[] = [];

    const maxDate = db.getArticleMaxModifiedOnDisk();
    if (maxDate.result) {
    }

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
}

interface Unknown {
    _type: "Unknown";
    error: string;
}
