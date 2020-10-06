import {
    assert,
    assertEquals,
    assertStrContains,
    assertThrowsAsync,
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
        articleDir: "./examples/",
        outputDir: "./.out.test/",
        layoutArticle: async (row) => {
            return `<body>${row.html}</body>`;
        },
        removeOldOutputFiles: true,
    });
    const articles = db.articles.getFrom(new Date("2020-01-01"));
    const resources = db.resources.getFrom(new Date("2020-01-01"));

    // Articles can be in any order, because they are created in parallel, sort
    // the results and remove IDs.
    articles.result
        ?.sort((a, b) => (a.local_path > b.local_path ? 1 : -1))
        .forEach((f) => (f.id = 0));
    if (!articles.result) {
        throw new Error(articles.error);
    }

    assertStrContains(articles.result[0].html, `<h1 id="example-post">Example post</h1>`);
    assertStrContains(
        await Deno.readTextFile("./.out.test/2020/09/post01/index.html"),
        `<body><h1 id="example-post">Example post</h1>`
    );

    assertStrContains(articles.result[1].html, `<h1 id="second-post">Second post</h1>`);
    assertStrContains(
        await Deno.readTextFile("./.out.test/2020/10/post02/index.html"),
        `<body><h1 id="second-post">Second post</h1>`
    );
    // assertEquals(gen, {});

    assertEquals(resources.result, [
        {
            id: 1,
            local_path: join(await Deno.realPath("./examples/res01.svg"), ""),
            modified_on_disk: (await Deno.stat("./examples/res01.svg")).mtime,
            server_path: "2020/10/post02/res01.svg",
        },
    ] as ResourceRow[]);

    assertEquals(articles.result, [
        {
            id: 0,

            // Git created
            created: new Date("2020-09-06T22:52:10.000Z"),

            // Git modified
            modified: new Date("2020-09-06T22:52:10.000Z"),

            modified_on_disk: (await Deno.stat("./examples/post01.md")).mtime,
            local_path: join(await Deno.realPath("./examples/post01.md"), ""),
            hash: "",
            server_path: "2020/09/post01/",
            html: articles.result[0].html,
        },
        {
            id: 0,

            // Git created
            created: new Date("2020-10-03T16:31:11.000Z"),

            // Git modified
            modified: new Date("2020-10-03T16:31:11.000Z"),

            modified_on_disk: (await Deno.stat("./examples/post02.md")).mtime,
            local_path: join(await Deno.realPath("./examples/post02.md"), ""),
            hash: "",
            server_path: "2020/10/post02/",
            html: articles.result[1].html,
        },
    ] as ArticleRow[]);
    db.close();
});
