import { assertEquals } from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { ResourceRepository, ResourceRow } from "./resources.ts";
import { DB } from "https://deno.land/x/sqlite@v2.3.0/src/db.ts";

Deno.test("resources createSchema", () => {
    const db = new DB(":memory:");
    const articles = new ResourceRepository(db);
    articles.createSchema();
    db.close(true);
});

Deno.test("resources add", () => {
    const db = new DB(":memory:");
    const articles = new ResourceRepository(db);
    articles.createSchema();
    assertEquals(
        articles.add({
            local_path: "examples/res01.svg",
            modified_on_disk: new Date(),
            server_path: "res01.svg",
        }),
        {
            result: 1,
        }
    );
    db.close(true);
});

Deno.test("resources getFrom", () => {
    const db = new DB(":memory:");
    const resources = new ResourceRepository(db);
    resources.createSchema();
    // Older post, omitted by filter
    resources.add({
        local_path: "examples/post01.md",
        modified_on_disk: new Date("2019-01-03"),
        server_path: "post01.html",
    });

    // Newer post, included by the filter (expected result)
    resources.add({
        local_path: "examples/post02.md",
        modified_on_disk: new Date("2020-01-03"),
        server_path: "post02.html",
    });

    const res = resources.getFrom(new Date("2020-01-01"));
    assertEquals(res, {
        result: [
            {
                id: 2,
                local_path: "examples/post02.md",
                modified_on_disk: new Date("2020-01-03"),
                server_path: "post02.html",
            },
        ] as ResourceRow[],
    });
    db.close(true);
});
