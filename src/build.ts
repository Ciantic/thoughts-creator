import { markdown } from "./markdown.ts";

import { gitLastEdit, gitCreated } from "./git.ts";
import { DbContext } from "./db/mod.ts";
import { getMaxModifiedOnDirectory, getRecursivelyFilesWithExt } from "./fs.ts";
import { workerOnce } from "./worker.ts";
import PromisePool from "https://unpkg.com/native-promise-pool@^3.15.0/edition-deno/index.ts";
import { basename } from "https://deno.land/std@0.68.0/path/mod.ts";

/**
 * Create database
 *
 * @param articleFiles
 */
export async function createDatabase(databaseFile: string) {
    const db = new DbContext(databaseFile);
    db.createSchema();
    return db;
}

/**
 * Generate HTML
 *
 * @param files Markdown files as list
 */
export async function generate(db: DbContext, articleFiles: string[], outputDir: string) {
    const outputModified = await getMaxModifiedOnDirectory(outputDir);
    const outputHtmlFiles = await getRecursivelyFilesWithExt(outputDir, "html");
    const articles = db.articles.getFrom(outputModified);

    const dbMaxDate = db.articles.getMaxModifiedOnDisk();
    if (dbMaxDate.error) {
        throw new Error("Unable to get max date");
    }
    let promisePool = new PromisePool(16);

    let articleWorkers = articleFiles.map((articleFile) =>
        promisePool.open(() =>
            // buildArticleWorker
            // or
            // buildArticle
            buildArticleWorker({
                articleFile,
                outputDir,
                databaseFile: db.getDatabaseFile(),
            })
        )
    );
    const articleCompletions = await Promise.allSettled(articleWorkers);
    const failed_files: { file: string; reason: any }[] = [];

    // Collect the results
    for (const [i, res] of articleCompletions.entries()) {
        const file = articleFiles[i];
        if (res.status == "fulfilled") {
            // Succeeded
        } else if (res.status == "rejected") {
            failed_files.push({
                file: file,
                reason: res.reason,
            });
        }
    }

    return {
        failed_files,
    };
}

/**
 *
 * @param file
 */
async function buildArticle(opts: {
    databaseFile: string;
    articleFile: string;
    outputDir: string;
}) {
    let { articleFile, databaseFile, outputDir } = opts;
    let db = new DbContext(databaseFile);
    let stat = await Deno.lstat(articleFile);
    let realpath = await Deno.realPath(articleFile);

    const maxDate = db.articles.getMaxModifiedOnDisk().result;
    if (!stat.mtime) {
        throw new Error("Modification date is missing");
    }

    // If the file is newer than in the database, add or update it
    if (!maxDate || stat.mtime > maxDate) {
        const created = await gitCreated(articleFile);
        const modified = await gitLastEdit(articleFile);
        const contents = await Deno.readFile(articleFile);
        const contents_str = new TextDecoder().decode(contents);
        const markdown_result = markdown(contents_str);
        db.articles.add({
            created: created,
            file: realpath,
            hash: "",
            modified: modified,
            modified_on_disk: stat.mtime,
            server_path: `${created.getFullYear()}/${(created.getMonth() + 1)
                .toString()
                .padStart(2, "0")}/${basename(articleFile, ".md")}/`,
            html: markdown_result.body,
        });
    }

    db.close();

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

const buildArticleWorker = workerOnce(import.meta, buildArticle);
