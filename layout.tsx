// @deno-types="https://servestjs.org/@v1.1.1/types/react/index.d.ts"
import { default as React } from "https://cdn.skypack.dev/react";

// @deno-types="https://servestjs.org/@v1.1.1/types/react-dom/server/index.d.ts"
import { default as ReactDOMServer } from "https://jspm.dev/react-dom/server.js";

type Post = {
    title: string;
    lastEdited: Date;
    link: URL;
    Content: () => JSX.Element;
};

const Html = ({ title, Content }: Post) => (
    <>
        <head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>{title}</title>
            <link rel="stylesheet" href="./style.css" />
        </head>
        <body>
            <Header></Header>
            <article>
                <Content />
            </article>
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

console.log("wtf", ReactDOMServer);

console.log(
    layout({
        Content: () => <div></div>,
        lastEdited: new Date(),
        link: new URL("https://example.com"),
        title: "",
    })
);
