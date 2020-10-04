import { markdown } from "./utils/markdown.ts";

import { gitLastEdit, gitCreated } from "./utils/git.ts";
import { DbContext } from "./db/mod.ts";
import { File, getRecursivelyFilesWithExt } from "./utils/fs.ts";
import { workerOnce } from "./utils/worker.ts";
import PromisePool from "https://unpkg.com/native-promise-pool@^3.15.0/edition-deno/index.ts";
import { basename, dirname, join, posix } from "https://deno.land/std/path/mod.ts";
import { ArticleRow } from "./db/articles.ts";
import { layout } from "./layout.tsx";

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

type GenerateOptions = {
    db: DbContext;
    articleDir: string;
    outputDir: string;
    layoutArticle?: (row: ArticleRow) => Promise<string>;
    // layoutPage?: (row)
};

/**
 * Generate HTML
 *
 * @param files Markdown files as list
 */
export async function generate(opts: GenerateOptions) {
    const { db, outputDir, articleDir, layoutArticle } = opts;
    const outputPath = await Deno.realPath(outputDir);
    const articlePath = await Deno.realPath(articleDir);
    const articleFilenames = await getRecursivelyFilesWithExt(articleDir, "md");
    const articleFiles = articleFilenames.map((f) => new File(f));
    const dbMaxDateRes = db.articles.getMaxModifiedOnDisk();
    const dbMaxDate = dbMaxDateRes.result;

    // Clean non-existing articles from the database
    const articleRealPaths = await Promise.all(articleFiles.map((f) => f.realpath()));
    db.articles.cleanNonExisting(articleRealPaths);

    // Runs 16 simultaneous promises at the time
    const promisePool = new PromisePool(16);
    const articleWorkers = articleFiles.map((articleFile) =>
        promisePool.open(async () => {
            if (!dbMaxDate || (await articleFile.modified()) > dbMaxDate)
                return buildArticle({
                    articleFile,
                    db,
                });
        })
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
                file: file.path,
                reason: res.reason,
            });
        }
    }

    await writeFiles({ db, outputPath, layoutArticle });

    return {
        failed_files,
    };
}

/**
 * Writes files
 *
 * @param db
 * @param outputPath
 */
async function writeFiles({
    db,
    outputPath,
    layoutArticle,
}: {
    db: DbContext;
    outputPath: string;
    layoutArticle?: (row: ArticleRow) => Promise<string>;
}) {
    const encoder = new TextEncoder();
    const promisePool = new PromisePool(16);
    let workers: Promise<string[]>[] = [];

    const articles = db.articles.getAll();
    if (articles.result)
        workers = workers.concat(
            articles.result.map((row) =>
                promisePool.open(async () => {
                    const outputFile = await Deno.realPath(
                        join(outputPath, row.server_path, "index.html")
                    );
                    if (!outputFile.startsWith(outputPath)) {
                        throw new Error(`Incorrect article path ${outputFile}`);
                    }
                    await Deno.mkdir(dirname(outputFile), {
                        recursive: true,
                    });
                    const html = layoutArticle ? await layoutArticle(row) : row.html;
                    await Deno.writeFile(outputFile, encoder.encode(html));
                    return [outputFile];
                })
            )
        );

    const resources = db.resources.getAll();
    if (resources.result)
        workers = workers.concat(
            resources.result.map((row) =>
                promisePool.open(async () => {
                    const outputFile = await Deno.realPath(join(outputPath, row.server_path));
                    if (!outputFile.startsWith(outputPath)) {
                        throw new Error(`Incorrect article path ${outputFile}`);
                    }
                    await Deno.mkdir(dirname(outputFile), {
                        recursive: true,
                    });
                    await Deno.copyFile(row.local_path, outputFile);
                    return [outputFile];
                })
            )
        );

    const writtenFiles = await Promise.all(workers);
    console.log("Written files", writtenFiles);
}

/**
 * Build resource
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
 * Build article
 */
async function buildArticle(opts: { db: DbContext; articleFile: File }) {
    let { articleFile, db } = opts;
    let mtime = await articleFile.modified();
    let realpath = await articleFile.realpath();
    const created = await gitCreated(articleFile.path);
    const modified = await gitLastEdit(articleFile.path);
    const contents = await articleFile.readtext();
    const markdown_result = markdown(contents);
    const year = created.getFullYear();
    const month = (created.getMonth() + 1).toString().padStart(2, "0");
    const filename = basename(articleFile.path, ".md");
    const serverpath = `${year}/${month}/${filename}/`;
    const html = markdown_result.body;
    db.articles.add({
        created: created,
        hash: "",
        modified: modified,
        modified_on_disk: mtime,
        local_path: realpath,
        server_path: serverpath,
        html: html,
    });
    await buildResources(db, dirname(realpath), serverpath, html);
}

const buildArticleWorker = workerOnce(import.meta, buildArticle);
