import {
    assert,
    assertEquals,
    assertThrowsAsync,
} from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { gitLastEdit } from "./git.ts";

Deno.test("gitLastEdit: works", async () => {
    let result = await gitLastEdit("./deps.ts");
    assertEquals(new Date("2020-08-04T20:27:11.000Z"), result);
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
