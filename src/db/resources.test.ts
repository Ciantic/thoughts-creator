import { assertEquals } from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { ResourceRepository, ResourceRow } from "./resources.ts";
import { DB } from "https://deno.land/x/sqlite/mod.ts";

Deno.test("resources createSchema", () => {
    const db = new DB(":memory:");
    const articles = new ResourceRepository(db);
    articles.createSchema();
    db.close(true);
});

Deno.test("resources add", () => {
    const db = new DB(":memory:");
    const repository = new ResourceRepository(db);
    repository.createSchema();
    assertEquals(
        repository.add({
            localPath: "examples/res01.svg",
            modifiedOnDisk: new Date(),
            serverPath: "res01.svg",
        }),
        {
            result: 1,
        }
    );
    db.close(true);
});

Deno.test("resources getFrom", () => {
    const db = new DB(":memory:");
    const repository = new ResourceRepository(db);
    repository.createSchema();
    // Older post, omitted by filter
    repository.add({
        localPath: "examples/post01.md",
        modifiedOnDisk: new Date("2019-01-03"),
        serverPath: "post01.html",
    });

    // Newer post, included by the filter (expected result)
    repository.add({
        localPath: "examples/post02.md",
        modifiedOnDisk: new Date("2020-01-03"),
        serverPath: "post02.html",
    });

    const res = repository.getFrom(new Date("2020-01-01"));
    assertEquals(res, {
        result: [
            {
                id: 2,
                localPath: "examples/post02.md",
                modifiedOnDisk: new Date("2020-01-03"),
                serverPath: "post02.html",
            } as ResourceRow,
        ],
    });
    db.close(true);
});
