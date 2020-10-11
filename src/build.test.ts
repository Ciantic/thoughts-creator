import {
    assert,
    assertEquals,
    assertStrContains,
    assertThrows,
} from "https://deno.land/std/testing/asserts.ts";
import { createDatabase, generate } from "./build.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import type { ArticleRow } from "./db/articles.ts";
import { ResourceRow } from "./db/resources.ts";

Deno.test("build db works", async () => {
    try {
        await Deno.mkdir(".out.test");
    } catch (e) {}
    try {
        await Deno.writeTextFile(".out.test/foo.html", "");
    } catch (e) {}

    try {
        await Deno.remove(".cache.test.db");
    } catch (e) {}

    const db = await createDatabase(".cache.test.db");

    const gen = await generate({
        db: db,
        articleDir: "./examples/articles/",
        outputDir: "./.out.test/",
        rootDir: "./examples/layout/",
        layoutArticle: async (row) => {
            return `<html><head><link href="/style.css" /><body>${row.html}</body>`;
        },
        removeExtraOutputFiles: true,
    });
    const articles = db.articles.getFrom(new Date("2020-01-01"));
    const resources = db.resources.getFrom(new Date("2020-01-01"));

    // Articles can be in any order, because they are created in parallel, sort
    // the results and remove IDs.
    articles.result
        ?.sort((a, b) => (a.localPath > b.localPath ? 1 : -1))
        .forEach((f) => (f.id = 0));
    if (!articles.result) {
        throw new Error(articles.error);
    }

    assertStrContains(articles.result[0].html, `<h1 id="example-post">Example post</h1>`);
    assertStrContains(
        await Deno.readTextFile("./.out.test/2020/10/post01/index.html"),
        `<body><h1 id="example-post">Example post</h1>`
    );

    assertStrContains(articles.result[1].html, `<h1 id="second-post">Second post</h1>`);
    assertStrContains(
        await Deno.readTextFile("./.out.test/2020/10/post02/index.html"),
        `<body><h1 id="second-post">Second post</h1>`
    );

    // Ensure that cleaning extra files works
    assertThrows(() => Deno.statSync("./.out.test/foo.html"));

    assertEquals(resources.result, [
        {
            id: 1,
            localPath: join(await Deno.realPath("./examples/articles/res01.svg"), ""),
            modifiedOnDisk: (await Deno.stat("./examples/articles/res01.svg")).mtime,
            serverPath: "2020/10/post02/res01.svg",
        },
        {
            id: 2,
            modifiedOnDisk: new Date("2020-10-11T17:15:39.083Z"),
            localPath: "C:\\Source\\Blog\\simples\\examples\\layout\\style.css",
            serverPath: "/style.css",
        },
    ] as ResourceRow[]);

    assertEquals(articles.result, [
        {
            id: 0,

            // Git created
            created: new Date("2020-10-11T17:18:37.000Z"),

            // Git modified
            modified: new Date("2020-10-11T17:18:37.000Z"),

            modifiedOnDisk: (await Deno.stat("./examples/articles/post01.md")).mtime,
            localPath: join(await Deno.realPath("./examples/articles/post01.md"), ""),
            hash: "",
            serverPath: "2020/10/post01/",
            html: articles.result[0].html,
        },
        {
            id: 0,

            // Git created
            created: new Date("2020-10-11T17:18:37.000Z"),

            // Git modified
            modified: new Date("2020-10-11T17:18:37.000Z"),

            modifiedOnDisk: (await Deno.stat("./examples/articles/post02.md")).mtime,
            localPath: join(await Deno.realPath("./examples/articles/post02.md"), ""),
            hash: "",
            serverPath: "2020/10/post02/",
            html: articles.result[1].html,
        },
    ] as ArticleRow[]);
    db.close();
});
