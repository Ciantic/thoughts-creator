import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { Rows } from "https://deno.land/x/sqlite@v2.3.0/src/rows.ts";
import { dbError } from "./helpers.ts";

export interface ArticleRow {
    id: number;
    hash: string;
    created: Date;
    modified: Date;
    modified_on_disk: Date;
    file: string;
    server_path: string;
}

type ArticleInsertRow = Omit<ArticleRow, "id">;

/**
 * `SELECT * FROM article` result mapper
 *
 * @param rows
 */
function* mapStarArticle(rows: Rows): Generator<ArticleRow> {
    for (const [id, hash, created, modified, modified_on_disk, file, server_path] of rows) {
        yield {
            id: +id,
            hash: hash,
            created: new Date(created),
            modified: new Date(modified),
            modified_on_disk: new Date(modified_on_disk),
            file: file,
            server_path: server_path,
        };
    }
}

export class ArticleRepository {
    constructor(private db: DB) {}

    createSchema() {
        this.db.query(
            `
            CREATE TABLE IF NOT EXISTS article (
                id               INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
                hash             VARCHAR (64)   NOT NULL,
                created          DATETIME       NOT NULL,
                modified         DATETIME       NOT NULL,
                modified_on_disk DATETIME       NOT NULL,
                file             VARCHAR (2048) NOT NULL UNIQUE,
                server_path        VARCHAR (2048) NOT NULL UNIQUE
            );
            `
        );
    }

    add(p: ArticleInsertRow) {
        return dbError(() => {
            this.db.query(
                `INSERT INTO article 
                    (hash, created, modified, modified_on_disk, file, server_path) 
                    VALUES(?, ?, ?, ?, ?, ?) 
                ON CONFLICT(file) DO 
                UPDATE SET 
                    hash = excluded.hash,
                    created = excluded.created,
                    modified = excluded.modified,
                    modified_on_disk = excluded.modified_on_disk,
                    server_path = excluded.server_path
                `,
                [p.hash, p.created, p.modified, p.modified_on_disk, p.file, p.server_path]
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
                "SELECT * FROM article WHERE modified_on_disk > :modified_on_disk_start",
                {
                    modified_on_disk_start,
                }
            );
            return [...mapStarArticle(q)];
        });
    }

    getMaxModifiedOnDisk() {
        return dbError(() => {
            const [maxdate] = [...this.db.query("SELECT MAX(modified_on_disk) FROM article")];
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
