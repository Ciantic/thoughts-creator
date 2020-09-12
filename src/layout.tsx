// @deno-types="https://servestjs.org/@v1.1.3/types/react/index.d.ts"
import React from "https://dev.jspm.io/react/index.js";

// @deno-types="https://servestjs.org/@v1.1.3/types/react-dom/server/index.d.ts"
import ReactDOMServer from "https://jspm.dev/react-dom/server.js";

type Post = {
    title: string;
    created: Date;
    lastEdited: Date;
    // link: URL;
    html: string;
};

const Html = ({ title, html }: Post) => (
    <>
        <head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>{title} - Ciantic's testing blog</title>
            <link rel="stylesheet" href="./style.css" />
        </head>
        <body>
            <Header></Header>
            <article dangerouslySetInnerHTML={{ __html: html }}></article>
        </body>
    </>
);

const Header = () => (
    <div className="header">
        <h1 className="title">This is my blog</h1>
    </div>
);

export function layout(p: Post): string {
    return ReactDOMServer.renderToString(<Html {...p} />);
}

export function renderFrontPage() {}

export function renderArticle(p: Post): string {
    return "";
}

// console.log("wtf", ReactDOMServer);

// console.log(
//     layout({
//         Content: () => <div></div>,
//         created: new Date(),
//         lastEdited: new Date(),
//         link: new URL("https://example.com"),
//         title: "",
//     })
// );
