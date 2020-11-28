import { basename, dirname, join, posix } from "https://deno.land/std/path/mod.ts";

import { File, getRecursivelyFilesWithExt, readDirRecursive } from "./utils/fs.ts";
import { markdown } from "./utils/markdown.ts";
import { gitLastEdit, gitCreated } from "./utils/git.ts";
import { DbContext } from "./db/mod.ts";
import { ArticleRow } from "./db/articles.ts";

async function createDatabase(databaseFile: string) {
    const db = new DbContext(databaseFile);
    db.createSchema();
    return db;
}

type GenerateResult = {
    db: DbContext;
    writtenArticles: string[];
    writtenResources: string[];
    failedArticles: string[];
    failedResources: string[];
};

const DEFAULT_GENERATE_PARAMS = {
    articleDir: "articles",
    outputDir: "out",
    rootDir: "root",
    dbFile: ".cache.db",
    cleanOutput: false,
    layoutArticle: undefined as ((db: DbContext, row: ArticleRow) => Promise<string>) | undefined,
};

export async function generate(
    opts: Partial<typeof DEFAULT_GENERATE_PARAMS>
): Promise<GenerateResult> {
    const { dbFile, outputDir, articleDir, layoutArticle, rootDir, cleanOutput } = Object.assign(
        {},
        DEFAULT_GENERATE_PARAMS,
        opts
    );

    // TODO: remove dummy join https://github.com/denoland/deno/issues/5685
    const db = await createDatabase(dbFile);

    const articlePath = join(await Deno.realPath(articleDir), "");
    const articleFilenames = await getRecursivelyFilesWithExt(articlePath, "md");
    const articleFiles = articleFilenames.map((f) => new File(f));
    const dbMaxDateRes = db.articles.getMaxModifiedOnDisk();
    const dbMaxDate = dbMaxDateRes.result;

    // Clean non-existing articles from the database
    const articleRealPaths = await Promise.all(articleFiles.map((f) => f.realpath()));
    db.articles.cleanNonExisting(articleRealPaths);

    const articleWorkers = articleFiles.map(async (articleFile) => {
        if (!dbMaxDate || (await articleFile.modified()) > dbMaxDate)
            return buildArticle({
                articleFile,
                db,
                rootDir,
            });
    });
    const articleCompletions = await Promise.allSettled(articleWorkers);
    const failedFiles: { file: string; reason: any }[] = [];

    // Collect the results
    for (const [i, res] of articleCompletions.entries()) {
        const file = articleFiles[i];
        if (res.status == "fulfilled") {
            // Succeeded
        } else if (res.status == "rejected") {
            failedFiles.push({
                file: file.path,
                reason: res.reason,
            });
        }
    }

    // Try to generate the output
    await Deno.mkdir(outputDir, {
        recursive: true,
    });
    const outputPath = join(await Deno.realPath(outputDir), "");
    const writtenFiles = await writeFiles({
        db,
        outputPath,
        layoutArticle: layoutArticle?.bind(null, db),
        rootDir,
    });

    if (cleanOutput) {
        await removeExtraOutputFiles(outputPath, writtenFiles);
    }

    // TODO: writtenArticles, writtenResources, failedArticles and
    // failedResources aren't populated

    return {
        db,
        writtenArticles: [],
        writtenResources: [],
        failedArticles: [],
        failedResources: [],
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
    rootDir,
}: {
    db: DbContext;
    rootDir: string;
    outputPath: string;
    layoutArticle?: (row: ArticleRow) => Promise<string>;
}) {
    const encoder = new TextEncoder();
    let articleWorkers: Promise<string>[] = [];
    let resourceWorkers: Promise<string>[] = [];
    let writtenArticles = [] as string[];
    let writtenResources = [] as string[];

    const articles = db.articles.getAll();
    if (articles.result)
        articleWorkers = articles.result.map(async (row) => {
            const outputFile = join(outputPath, row.serverPath, "index.html");
            if (!outputFile.startsWith(outputPath)) {
                throw new Error(`Incorrect article path ${outputFile}`);
            }
            await Deno.mkdir(dirname(outputFile), {
                recursive: true,
            });
            const html = layoutArticle ? await layoutArticle(row) : row.html;
            try {
                await buildResources({
                    db: db,
                    rootDir,
                    htmlLocalDir: dirname(row.localPath),
                    htmlServerPath: row.serverPath,
                    html,
                });
            } catch (e) {
                // TODO: Append to resource build failures
            }
            await Deno.writeFile(outputFile, encoder.encode(html));
            return outputFile;
        });

    writtenArticles = await Promise.all(articleWorkers);

    const resources = db.resources.getAll();
    if (resources.result)
        resourceWorkers = resources.result.map(async (row) => {
            const outputFile = join(outputPath, row.serverPath);
            if (!outputFile.startsWith(outputPath)) {
                throw new Error(`Incorrect article path ${outputFile}`);
            }
            await Deno.mkdir(dirname(outputFile), {
                recursive: true,
            });
            await Deno.copyFile(row.localPath, outputFile);
            return outputFile;
        });

    writtenResources = await Promise.all(resourceWorkers);
    return [...writtenArticles, ...writtenResources];
}

async function removeExtraOutputFiles(outputPath: string, writtenFiles: string[]) {
    let writtenFilesSet = new Set(writtenFiles);
    let oldOutputFiles = await readDirRecursive(outputPath);
    let extraFiles = oldOutputFiles.filter((x) => !writtenFilesSet.has(x));
    let removals = extraFiles.map((f) => Deno.remove(f));
    await Promise.all(removals);
    return extraFiles;
}

/**
 * Build resource
 */
async function buildResources(opts: {
    db: DbContext;
    rootDir: string;
    htmlLocalDir: string;
    htmlServerPath: string;
    html: string;
}) {
    const { db, htmlLocalDir, htmlServerPath, html, rootDir } = opts;
    let matches = [...html.matchAll(/href="(.*?)"/g)];
    matches = [...matches, ...html.matchAll(/src="(.*?)"/g)];
    const hasFileExtension = (s: string) => !!s.match(/\.([^\./]+)$/);
    for (const [_, possibleUrl] of matches) {
        if (possibleUrl.match(/:\/\//)) {
            // Fully qualified URL
            // TODO: Collect external urls to database for screenshotting and
            // alive tests
        } else if (possibleUrl.startsWith("#")) {
            // TODO: What to do with bare hash links?
        } else if (possibleUrl.startsWith("/")) {
            // Url pointing to root of the server
            if (hasFileExtension(possibleUrl)) {
                let filePath = join(rootDir, possibleUrl);
                let realFilePath = join(await Deno.realPath(filePath), "");
                let stat = await Deno.stat(realFilePath);
                let serverPath = posix.join("/", possibleUrl);
                db.resources.add({
                    localPath: realFilePath,
                    serverPath: serverPath,
                    modifiedOnDisk: stat.mtime ?? new Date(),
                });
            }
        } else {
            // Relative url

            // Relative file with extension, treat as a resource file
            if (hasFileExtension(possibleUrl)) {
                let filePath = join(htmlLocalDir, possibleUrl);
                let realFilePath = join(await Deno.realPath(filePath), "");
                let stat = await Deno.stat(realFilePath);
                let serverPath = posix.join(htmlServerPath, possibleUrl);
                db.resources.add({
                    localPath: realFilePath,
                    serverPath: serverPath,
                    modifiedOnDisk: stat.mtime ?? new Date(),
                });
            } else {
                // TODO: Relative links to other articles perhaps?
            }
        }
    }
}

/**
 * Build article
 */
async function buildArticle(opts: { db: DbContext; articleFile: File; rootDir: string }) {
    let { articleFile, db, rootDir } = opts;
    let mtime = await articleFile.modified();
    let realpath = await articleFile.realpath();
    const created = await gitCreated(articleFile.path);
    const modified = await gitLastEdit(articleFile.path);
    const contents = await articleFile.readtext();
    const markdown_result = markdown(contents);
    const year = created.getFullYear();
    const month = (created.getMonth() + 1).toString().padStart(2, "0");
    const filename = basename(articleFile.path, ".md");
    const serverpath = `articles/${filename}/`;
    const html = markdown_result.body;
    db.articles.add({
        created: created,
        hash: "",
        modified: modified,
        modifiedOnDisk: mtime,
        localPath: realpath,
        serverPath: serverpath,
        title: markdown_result.title,
        html: html,
    });
    await buildResources({
        db: db,
        rootDir: rootDir,
        htmlLocalDir: dirname(realpath),
        htmlServerPath: serverpath,
        html,
    });
}
