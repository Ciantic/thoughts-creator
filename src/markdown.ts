import { default as hljs } from "https://cdn.skypack.dev/highlight.js@^10.0.3";
import { parseAsFrontMatter } from "https://cdn.skypack.dev/parse-yaml@^0.1.0";
import { Marked, Renderer } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import { recursiveReaddir } from "https://deno.land/x/recursive_readdir@v2.0.0/mod.ts";
import { join, extname } from "https://deno.land/std/path/mod.ts";

// Setup marked with highlight.js
Marked.setOptions({
    renderer: new Renderer(),
    highlight: function (code: any, language: any) {
        const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
        return hljs.highlight(validLanguage, code).value;
    },
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    xhtml: false,
});

export type MarkdownResult = ReturnType<typeof markdown>;

export function markdown(fileContents: string) {
    const { attributes, body } = parseAsFrontMatter(fileContents);
    // const { attributes, body } = frontMatter(fileContents);
    const published = Date.parse(attributes.published);
    const parsed = Marked.parse(body);

    return {
        published: isNaN(published) ? null : new Date(published),
        body: parsed.content,
    };
}

/**
 * Get all markdown files
 * @param dir
 */
export async function getMarkdownFiles(dir: string) {
    return (await recursiveReaddir(dir)).filter((file) => extname(file) === ".md");
}
/*
import { default as unified } from "https://jspm.dev/unified";
import { default as createStream } from "https://jspm.dev/unified-stream";
import { default as remarkParse } from "https://jspm.dev/remark-parse";
import { default as remarkReHype } from "https://jspm.dev/remark-rehype";
import { default as remarkHtml } from "https://jspm.dev/rehype-stringify";

const processor = unified()
    .use(remarkParse, { commonmark: true })
    .use(remarkReHype)
    .use(remarkHtml);

// createStream(); ??

*/
