import {
    assert,
    assertEquals,
    assertThrowsAsync,
} from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { gitLastEdit, gitCreated } from "./git.ts";

Deno.test("gitLastEdit: works", async () => {
    let result = await gitLastEdit("./examples/articles/post01.md");
    assertEquals(result, new Date("2020-11-28T00:10:02.000Z"));
});

Deno.test("gitCreated: works", async () => {
    let result = await gitCreated("./examples/articles/post01.md");
    assertEquals(result, new Date("2020-10-11T17:18:37.000Z"));
});

Deno.test("gitLastEdit: it gives an error", async () => {
    await assertThrowsAsync(
        async () => {
            return await gitLastEdit("not existing");
        },
        Error,
        "git call error"
    );
});
