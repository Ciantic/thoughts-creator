import {
    assert,
    assertEquals,
    assertThrowsAsync,
} from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { createDatabase } from "./build.ts";

Deno.test("build db works", async () => {
    const db = await createDatabase(".cache.test.db", [
        "./examples/post01.md",
        "./examples/post02.md",
    ]);
    const articles = db.getArticlesFrom(new Date("2020-01-01"));
    assertEquals(articles.result, [
        {
            // Git created
            created: new Date("2020-09-06T22:52:10.000Z"),
            file: await Deno.realPath("./examples/post01.md"),
            hash: "",
            id: 1,

            // Git modified
            modified: new Date("2020-09-06T22:52:10.000Z"),
            modified_on_disk: (await Deno.stat("./examples/post01.md")).mtime,
        },
    ]);
    db.close();
});
