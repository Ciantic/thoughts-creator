import type { DB } from "https://deno.land/x/sqlite/mod.ts";
import type { Rows } from "https://deno.land/x/sqlite/src/rows.ts";
import { dbError, fields, upsert } from "./helpers.ts";

export interface ArticleRow {
    id: number;
    hash: string;
    created: Date;
    modified: Date;
    modified_on_disk: Date;
    local_path: string;
    server_path: string;
    html: string;
}

type ArticleInsertRow = Omit<ArticleRow, "id">;

const f = fields<ArticleRow>();
const table = "article";

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
            local_path: file,
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
            CREATE TABLE IF NOT EXISTS ${table} (
                ${f.id}               INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
                ${f.hash}             VARCHAR (64)   NOT NULL,
                ${f.created}          DATETIME       NOT NULL,
                ${f.modified}         DATETIME       NOT NULL,
                ${f.modified_on_disk} DATETIME       NOT NULL,
                ${f.local_path}       VARCHAR (2048) NOT NULL UNIQUE,
                ${f.server_path}      VARCHAR (2048) NOT NULL UNIQUE,
                ${f.html}             VARCHAR (10048) NOT NULL DEFAULT ""
            );
            `
        );
    }

    add = upsert<ArticleInsertRow>({
        db: this.db,
        conflict: f.local_path,
        table: table,
        args: [
            f.hash,
            f.created,
            f.modified,
            f.modified_on_disk,
            f.local_path,
            f.server_path,
            f.html,
        ],
    });

    cleanNonExisting(existingArticleFiles: string[]) {
        const questionmarks = existingArticleFiles.map(() => "?").join(",");
        return dbError(() => {
            return this.db.query(
                `DELETE FROM ${table} WHERE ${f.local_path} NOT IN (${questionmarks})`,
                existingArticleFiles
            );
        });
    }

    getAll() {
        return dbError(() => {
            const q = this.db.query(`SELECT * FROM ${table}`);
            return [...mapStarArticle(q)];
        });
    }

    getFrom(modified_on_disk_start: Date) {
        return dbError(() => {
            const q = this.db.query(
                `SELECT * FROM ${table} WHERE ${f.modified_on_disk} > :modified_on_disk_start`,
                {
                    modified_on_disk_start,
                }
            );
            return [...mapStarArticle(q)];
        });
    }

    getMaxModifiedOnDisk() {
        return dbError(() => {
            const [maxdate] = [...this.db.query(`SELECT MAX(${f.modified_on_disk}) FROM ${table}`)];
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
