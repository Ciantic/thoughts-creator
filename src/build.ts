import { markdown } from "./markdown.ts";

import { gitLastEdit, gitCreated } from "./git.ts";
import { DbContext } from "./db/mod.ts";
import { getMaxModifiedOnDirectory, getRecursivelyFilesWithExt } from "./fs.ts";
import { workerOnce } from "./worker.ts";
import PromisePool from "https://unpkg.com/native-promise-pool@^3.15.0/edition-deno/index.ts";
import { basename, dirname, join, posix } from "https://deno.land/std@0.68.0/path/mod.ts";

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

    // Runs 16 simultaneous promises at the time
    let promisePool = new PromisePool(16);
    let articleWorkers = articleFiles.map((articleFile) =>
        promisePool.open(() =>
            // buildArticleWorker
            // or
            // buildArticle
            buildArticle({
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

    await writeFiles(db, outputDir);

    return {
        failed_files,
    };
}

/**
 * Writes files
 *
 * @param db
 * @param outPath
 */
async function writeFiles(db: DbContext, outPath: string) {
    const articles = db.articles.getAll();
    const encoder = new TextEncoder();

    if (articles.result) {
        for (const f of articles.result) {
            const dir = join(outPath, f.server_path);
            const path = join(dir, "index.html");
            await Deno.mkdir(dir, {
                recursive: true,
            });
            await Deno.writeFile(path, encoder.encode(f.html));
        }
    }

    const resources = db.resources.getAll();
    if (resources.result) {
        for (const f of resources.result) {
            const dst = join(outPath, f.server_path);
            const dir = dirname(dst);
            await Deno.mkdir(dir, {
                recursive: true,
            });
            await Deno.copyFile(f.local_path, dst);
        }
    }
}

/**
 *
 * @param db
 * @param html
 */
async function buildResources(
    db: DbContext,
    local_path: string,
    server_path: string,
    html: string
) {
    let matches = [...html.matchAll(/href="(.*?)"/g)];
    matches = [...matches, ...html.matchAll(/src="(.*?)"/g)];
    for (const [_, possibleUrl] of matches) {
        if (possibleUrl.match(/:\/\//)) {
            // TODO: Collect external urls to database for screenshotting and
            // alive tests
        } else if (possibleUrl.startsWith("#")) {
            // TODO: What to do with bare hash links?
        } else if (possibleUrl.match(/\.([^\./]+)$/)) {
            // File with extension, treat as a resource file
            let filePath = join(local_path, possibleUrl);
            let realFilePath = await Deno.realPath(filePath);
            let stat = await Deno.stat(realFilePath);
            let serverPath = posix.join(server_path, possibleUrl);
            db.resources.add({
                local_path: realFilePath,
                server_path: serverPath,
                modified_on_disk: stat.mtime ?? new Date(),
            });
        } else {
            // TODO: Relative links to other articles perhaps?
        }
    }
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
    try {
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
            const year = created.getFullYear();
            const month = (created.getMonth() + 1).toString().padStart(2, "0");
            const filename = basename(articleFile, ".md");
            const serverpath = `${year}/${month}/${filename}/`;
            db.articles.add({
                created: created,
                hash: "",
                modified: modified,
                modified_on_disk: stat.mtime,
                local_path: realpath,
                server_path: serverpath,
                html: markdown_result.body,
            });
            await buildResources(db, dirname(realpath), serverpath, markdown_result.body);
        }
    } catch (e) {
        throw e;
    } finally {
        db.close();
    }

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
