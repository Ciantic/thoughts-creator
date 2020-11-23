import {
    assert,
    assertEquals,
    assertThrowsAsync,
} from "https://deno.land/std@0.63.0/testing/asserts.ts";

import { markdown } from "./markdown.ts";

const example = `---
foo: yea
date: 2020-01-01 12:30 +03:00
---
# Example header

\`\`\`typescript
var foo: any;
\`\`\`

The paragraph
`;

const expectedBody = `<h1 id=\"example-header\">Example header</h1>

<pre><code class=\"lang-typescript\"><span class=\"hljs-keyword\">var</span> foo: <span class=\"hljs-built_in\">any</span>;
</code></pre>
<p>The paragraph</p>
`;

Deno.test("markdown works", () => {
    const result = markdown(example);
    assertEquals(result.date, new Date("2020-01-01T09:30:00.000Z"));
    assertEquals(result.body, expectedBody);
    assertEquals(result.body.length, expectedBody.length);
});
