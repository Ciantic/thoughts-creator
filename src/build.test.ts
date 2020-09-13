import {
    assert,
    assertEquals,
    assertThrowsAsync,
} from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { createDatabase, generate } from "./build.ts";
import type { ArticleRow } from "./db/articles.ts";

Deno.test("build db works", async () => {
    try {
        await Deno.mkdir(".out.test");
    } catch (e) {}

    try {
        await Deno.remove(".cache.test.db");
    } catch (e) {}

    const db = await createDatabase(".cache.test.db");

    await generate(db, ["./examples/post01.md", "./examples/post02.md"], ".out.test");
    const articles = db.articles.getFrom(new Date("2020-01-01"));

    // Articles can be in any order, because they are created in parallel, sort
    // the results and remove IDs.
    articles.result?.sort((a, b) => (a.file > b.file ? 1 : -1)).forEach((f) => (f.id = 0));

    assertEquals(articles.result, [
        {
            id: 0,

            // Git created
            created: new Date("2020-09-06T22:52:10.000Z"),

            // Git modified
            modified: new Date("2020-09-06T22:52:10.000Z"),

            modified_on_disk: (await Deno.stat("./examples/post01.md")).mtime,
            file: await Deno.realPath("./examples/post01.md"),
            hash: "",
            server_path: "2020/09/post01/",
        },
        {
            id: 0,

            // Git created
            created: new Date("2020-09-12T17:03:56.000Z"),

            // Git modified
            modified: new Date("2020-09-12T17:03:56.000Z"),

            modified_on_disk: (await Deno.stat("./examples/post02.md")).mtime,
            file: await Deno.realPath("./examples/post02.md"),
            hash: "",
            server_path: "2020/09/post02/",
        },
    ] as ArticleRow[]);
    db.close();
});
