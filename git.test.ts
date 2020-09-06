import {
    assert,
    assertEquals,
    assertThrowsAsync,
} from "https://deno.land/std@0.63.0/testing/asserts.ts";
import { gitLastEdit } from "./git.ts";

Deno.test("gitLastEdit: works", async () => {
    let result = await gitLastEdit("./build.ts");
    assertEquals(new Date("2020-08-05T23:14:27.000Z"), result);
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
