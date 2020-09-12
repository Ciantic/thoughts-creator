import {
    assert,
    assertEquals,
    assertThrowsAsync,
} from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { DbContext } from "./db.ts";

Deno.test("db creation works", () => {
    const db = new DbContext(":memory:");
    assertEquals(db.createSchema(), { result: true });
});

Deno.test("db addArticle works", () => {
    const db = new DbContext(":memory:");
    db.createSchema();
    assertEquals(
        db.addArticle({
            created: new Date(),
            file: "examples/post01.md",
            hash: "abcdefg",
            modified: new Date(),
            modified_on_disk: new Date(),
        }),
        {
            result: 1,
        }
    );
});

Deno.test("db getArticlesFrom works", () => {
    const db = new DbContext(":memory:");
    db.createSchema();
    // Older post, omitted by filter
    db.addArticle({
        created: new Date("2010-01-01"),
        file: "examples/post01.md",
        hash: "firstitem",
        modified: new Date("2019-01-02"),
        modified_on_disk: new Date("2019-01-03"),
    });

    // Newer post, included by the filter (expected result)
    db.addArticle({
        created: new Date("2020-01-01"),
        file: "examples/post02.md",
        hash: "seconditem",
        modified: new Date("2020-01-02"),
        modified_on_disk: new Date("2020-01-03"),
    });

    const res = db.getArticlesFrom(new Date("2020-01-01"));
    if (!res.result) {
        throw new Error("Fail");
    }
    assertEquals(res.result[0], {
        id: 2,
        created: new Date("2020-01-01"),
        file: "examples/post02.md",
        hash: "seconditem",
        modified: new Date("2020-01-02"),
        modified_on_disk: new Date("2020-01-03"),
    });
});

Deno.test("db getArticleMaxModifiedOnDisk works", () => {
    const db = new DbContext(":memory:");
    db.createSchema();

    // Older post
    db.addArticle({
        created: new Date("2010-01-01"),
        file: "examples/post01.md",
        hash: "firstitem",
        modified: new Date("2019-01-02"),
        modified_on_disk: new Date("2019-01-03"),
    });

    // Newer post
    db.addArticle({
        created: new Date("2020-01-01"),
        file: "examples/post02.md",
        hash: "seconditem",
        modified: new Date("2020-01-02"),
        modified_on_disk: new Date("2020-01-03"),
    });

    const res = db.getArticleMaxModifiedOnDisk();
    if (!res.result) {
        throw new Error("Fail");
    }
    assertEquals(res.result, new Date("2020-01-03"));
});

Deno.test("db cleanOldArticles works", () => {
    const db = new DbContext(":memory:");
    db.createSchema();

    // Older post
    db.addArticle({
        created: new Date("2010-01-01"),
        file: "examples/post01.md",
        hash: "firstitem",
        modified: new Date("2019-01-02"),
        modified_on_disk: new Date("2019-01-03"),
    });

    // Newer post
    db.addArticle({
        created: new Date("2020-01-01"),
        file: "examples/post02.md",
        hash: "seconditem",
        modified: new Date("2020-01-02"),
        modified_on_disk: new Date("2020-01-03"),
    });

    const res = db.cleanOldArticles(["examples/post02.md"]);
    if (!res.result) {
        throw new Error(res.error);
    }
    assertEquals(1, db.getArticlesFrom(new Date("2000-01-01")).result?.length);
});
