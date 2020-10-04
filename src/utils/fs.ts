import { recursiveReaddir } from "https://deno.land/x/recursive_readdir@v2.0.0/mod.ts";
import { join, extname } from "https://deno.land/std/path/mod.ts";

// export const recursiveReaddir = recursiveReaddir;

export async function getRecursivelyFilesWithExt(dir: string, ext: string) {
    return (await recursiveReaddir(dir)).filter((file) => extname(file) === "." + ext);
}

export async function getMaxModifiedOnDirectory(dir: string) {
    return new Date();
}

class File {
    private _realPath?: Promise<string>;

    constructor(private file: string) {}

    get path() {
        return this.file;
    }

    get realpath() {
        return Deno.realPath(this.file);
    }
}
