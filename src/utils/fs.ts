import { recursiveReaddir } from "https://deno.land/x/recursive_readdir@v2.0.0/mod.ts";
import { join, extname } from "https://deno.land/std/path/mod.ts";

// export const recursiveReaddir = recursiveReaddir;

export async function getRecursivelyFilesWithExt(dir: string, ext: string) {
    return (await recursiveReaddir(dir)).filter((file) => extname(file) === "." + ext);
}

export class File {
    private _fileInfo?: Deno.FileInfo;
    private _realPath?: string;
    private _text?: string;

    constructor(private file: string) {}

    get path() {
        return this.file;
    }

    async realpath() {
        this._realPath = join(await Deno.realPath(this.file), "");
        return this._realPath;
    }

    async stat() {
        if (!this._fileInfo) {
            this._fileInfo = await Deno.stat(this.file);
        }
        return this._fileInfo;
    }

    async modified() {
        return (await this.stat()).mtime ?? new Date();
    }

    async readtext() {
        if (typeof this._text === "undefined") {
            this._text = new TextDecoder().decode(await Deno.readFile(this.path));
        }
        return this._text;
    }
}
