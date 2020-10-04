async function gitDate(file: string, flag: string = "") {
    const p = Deno.run({
        cmd: ["git", "log", "-1", flag, "--pretty=format:%ci", file].filter((v) => v),
        stdout: "piped",
        stderr: "piped",
    });

    const [status, out, err] = await Promise.all([p.status(), p.output(), p.stderrOutput()]);
    p.close(); // This should be `defer p.close()`

    const decoder = new TextDecoder();
    const outputStr = decoder.decode(out);
    const outputStrErr = decoder.decode(err);

    if (status.code == 0) {
        let date = Date.parse(outputStr);
        if (isNaN(date)) {
            throw new Error("Invalid date");
        } else {
            return new Date(date);
        }
    } else {
        throw new Error(`git call error: ${outputStrErr}`);
    }
}

/**
 * Creation date
 *
 * @param file File
 */
export async function gitCreated(file: string) {
    return await gitDate(file, "--reverse");
}

/**
 * Last edited
 *
 * @param file File
 */
export async function gitLastEdit(file: string) {
    return await gitDate(file);
}
