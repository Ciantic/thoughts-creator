import {
    assert,
    assertEquals,
    assertThrowsAsync,
} from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { DbContext } from "./mod.ts";
import type { ArticleRow } from "./articles.ts";
import { ArticleRepository } from "./articles.ts";
import { DB } from "https://deno.land/x/sqlite@v2.3.0/src/db.ts";

Deno.test("articles createSchema", () => {
    const db = new DB(":memory:");
    const articles = new ArticleRepository(db);
    articles.createSchema();
    db.close(true);
});

Deno.test("articles add", () => {
    const db = new DB(":memory:");
    const articles = new ArticleRepository(db);
    articles.createSchema();
    assertEquals(
        articles.add({
            created: new Date(),
            localPath: "examples/post01.md",
            hash: "abcdefg",
            modified: new Date(),
            modifiedOnDisk: new Date(),
            serverPath: "post01.html",
            html: "",
        }),
        {
            result: 1,
        }
    );
    db.close(true);
});

// TODO: articles.getAll

Deno.test("articles getFrom", () => {
    const db = new DB(":memory:");
    const articles = new ArticleRepository(db);
    articles.createSchema();
    // Older post, omitted by filter
    articles.add({
        created: new Date("2010-01-01"),
        localPath: "examples/post01.md",
        hash: "firstitem",
        modified: new Date("2019-01-02"),
        modifiedOnDisk: new Date("2019-01-03"),
        serverPath: "post01.html",
        html: "first",
    });

    // Newer post, included by the filter (expected result)
    articles.add({
        created: new Date("2020-01-01"),
        localPath: "examples/post02.md",
        hash: "seconditem",
        modified: new Date("2020-01-02"),
        modifiedOnDisk: new Date("2020-01-03"),
        serverPath: "post02.html",
        html: "second",
    });

    const res = articles.getFrom(new Date("2020-01-01"));
    if (!res.result) {
        throw new Error("Fail");
    }
    assertEquals(res.result[0], {
        id: 2,
        created: new Date("2020-01-01"),
        localPath: "examples/post02.md",
        hash: "seconditem",
        modified: new Date("2020-01-02"),
        modifiedOnDisk: new Date("2020-01-03"),
        serverPath: "post02.html",
        html: "second",
    } as ArticleRow);
    db.close(true);
});

Deno.test("articles getMaxModifiedOnDisk", () => {
    const db = new DB(":memory:");
    const articles = new ArticleRepository(db);
    articles.createSchema();

    // Older post
    articles.add({
        created: new Date("2010-01-01"),
        localPath: "examples/post01.md",
        hash: "firstitem",
        modified: new Date("2019-01-02"),
        modifiedOnDisk: new Date("2019-01-03"),
        serverPath: "post01.html",
        html: "",
    });

    // Newer post
    articles.add({
        created: new Date("2020-01-01"),
        localPath: "examples/post02.md",
        hash: "seconditem",
        modified: new Date("2020-01-02"),
        modifiedOnDisk: new Date("2020-01-03"),
        serverPath: "post02.html",
        html: "",
    });

    const res = articles.getMaxModifiedOnDisk();
    if (!res.result) {
        throw new Error("Fail");
    }
    assertEquals(res.result, new Date("2020-01-03"));
    db.close(true);
});

Deno.test("articles cleanNonExisting", () => {
    const db = new DB(":memory:");
    const articles = new ArticleRepository(db);
    articles.createSchema();

    // Older post
    articles.add({
        created: new Date("2010-01-01"),
        localPath: "examples/post01.md",
        hash: "firstitem",
        modified: new Date("2019-01-02"),
        modifiedOnDisk: new Date("2019-01-03"),
        serverPath: "post01.html",
        html: "",
    });

    // Newer post
    articles.add({
        created: new Date("2020-01-01"),
        localPath: "examples/post02.md",
        hash: "seconditem",
        modified: new Date("2020-01-02"),
        modifiedOnDisk: new Date("2020-01-03"),
        serverPath: "post02.html",
        html: "",
    });

    const res = articles.cleanNonExisting(["examples/post02.md"]);
    if (!res.result) {
        throw new Error(res.error);
    }
    assertEquals(1, articles.getFrom(new Date("2000-01-01")).result?.length);
    db.close(true);
});
