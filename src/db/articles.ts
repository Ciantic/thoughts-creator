import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { Rows } from "https://deno.land/x/sqlite@v2.3.0/src/rows.ts";
import { dbError, nameof } from "./helpers.ts";

export interface ArticleRow {
    id: number;
    hash: string;
    created: Date;
    modified: Date;
    modified_on_disk: Date;
    file: string;
    server_path: string;
    html: string;
}

type ArticleInsertRow = Omit<ArticleRow, "id">;

const f = nameof<ArticleRow>();

/**
 * `SELECT * FROM article` result mapper
 *
 * @param rows
 */
function* mapStarArticle(rows: Rows): Generator<ArticleRow> {
    for (const [id, hash, created, modified, modified_on_disk, file, server_path, html] of rows) {
        yield {
            id: +id,
            hash: hash,
            created: new Date(created),
            modified: new Date(modified),
            modified_on_disk: new Date(modified_on_disk),
            file: file,
            server_path: server_path,
            html: html,
        };
    }
}

export class ArticleRepository {
    constructor(private db: DB) {}

    createSchema() {
        this.db.query(
            `
            CREATE TABLE IF NOT EXISTS article (
                ${f("id")}               INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
                ${f("hash")}             VARCHAR (64)   NOT NULL,
                ${f("created")}          DATETIME       NOT NULL,
                ${f("modified")}         DATETIME       NOT NULL,
                ${f("modified_on_disk")} DATETIME       NOT NULL,
                ${f("file")}             VARCHAR (2048) NOT NULL UNIQUE,
                ${f("server_path")}      VARCHAR (2048) NOT NULL UNIQUE,
                ${f("html")}             VARCHAR (10048) NOT NULL DEFAULT ""
            );
            `
        );
    }

    add(p: ArticleInsertRow) {
        return dbError(() => {
            this.db.query(
                `INSERT INTO article 
                    (
                        ${f("hash")}, 
                        ${f("created")}, 
                        ${f("modified")}, 
                        ${f("modified_on_disk")}, 
                        ${f("file")}, 
                        ${f("server_path")}, 
                        ${f("html")}
                    ) 
                    VALUES(?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(${f("file")}) DO 
                UPDATE SET 
                    ${f("hash")} = excluded.${f("hash")},
                    ${f("created")} = excluded.${f("created")},
                    ${f("modified")} = excluded.${f("modified")},
                    ${f("modified_on_disk")} = excluded.${f("modified_on_disk")},
                    ${f("server_path")} = excluded.${f("server_path")},
                    ${f("html")} = excluded.${f("html")}
                `,
                [p.hash, p.created, p.modified, p.modified_on_disk, p.file, p.server_path, p.html]
            );

            return +this.db.lastInsertRowId;
        });
    }

    cleanNonExisting(existingArticleFiles: string[]) {
        const questionmarks = existingArticleFiles.map(() => "?").join(",");
        return dbError(() => {
            return this.db.query(
                `DELETE FROM article WHERE file NOT IN (${questionmarks})`,
                existingArticleFiles
            );
        });
    }

    getFrom(modified_on_disk_start: Date) {
        return dbError(() => {
            const q = this.db.query(
                `SELECT * FROM article WHERE ${f("modified_on_disk")} > :modified_on_disk_start`,
                {
                    modified_on_disk_start,
                }
            );
            return [...mapStarArticle(q)];
        });
    }

    getMaxModifiedOnDisk() {
        return dbError(() => {
            const [maxdate] = [
                ...this.db.query(`SELECT MAX(${f("modified_on_disk")}) FROM article`),
            ];
            if (!maxdate) {
                throw new Error("No articles");
            }
            const date = new Date(maxdate);
            if (date.toString() !== "Invalid Date") {
                return date;
            }
            return null;
        });
    }
}
