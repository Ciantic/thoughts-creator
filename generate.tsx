import { React, ReactDOMServer } from "./deps.ts";

/**
 * Last edited
 *
 * @param file File
 */
async function gitLastEdit(file: string) {
    const p = Deno.run({
        cmd: ["git", "log", "-1", "--pretty=format:%ci", file],
    });
    const status = await p.status();
    if (status.code == 0) {
        const output = await p.output();
        const outputStr = new TextDecoder().decode(output);
        return outputStr;
    } else {
        throw new Error("GIT Error");
    }
}

console.log(
    ReactDOMServer.renderToString(
        <div>
            <span className="foo">Test</span>
            <div className="test">Foo</div>
        </div>
    )
);
