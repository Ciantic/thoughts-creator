// new Worker(new URL("worker.js", import.meta.url).href, { type: "module" });

import { default as marked } from "https://jspm.dev/marked";
import { default as frontMatter } from "https://jspm.dev/front-matter";
import { default as hljs } from "https://jspm.dev/highlight.js";

// Setup marked with highlight.js
marked.setOptions({
    renderer: new marked.Renderer(),
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
    const { attributes, body } = frontMatter(fileContents);
    const published = Date.parse(attributes.published);
    return {
        published: isNaN(published) ? null : new Date(published),
        body: marked(body) as string,
    };
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
