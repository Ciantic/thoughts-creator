import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { Rows } from "https://deno.land/x/sqlite@v2.3.0/src/rows.ts";

function err<T>(f: () => T) {
    try {
        return {
            result: f(),
        };
    } catch (error) {
        return {
            error: error.toString(),
            stack: error.stack,
        };
    }
}

interface ArticleRow {
    id: number;
    hash: string;
    created: Date;
    modified: Date;
    modified_on_disk: Date;
    file: string;
}

type ArticleInsertRow = Omit<ArticleRow, "id">;

function* mapStarArticle(rows: Rows): Generator<ArticleRow> {
    for (const [id, hash, created, modified, modified_on_disk, file] of rows) {
        yield {
            id: +id,
            hash: hash,
            created: new Date(created),
            modified: new Date(modified),
            modified_on_disk: new Date(modified_on_disk),
            file: file,
        };
    }
}

export class DbContext {
    private db: DB;
    constructor(db: string) {
        this.db = new DB(db);
    }

    createSchema() {
        return err(() => {
            this.db.query("PRAGMA default_temp_store = MEMORY;");
            return (
                this.db
                    .query(
                        `
                        CREATE TABLE IF NOT EXISTS article (
                            id               INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
                            hash             VARCHAR (64)   NOT NULL,
                            created          DATETIME       NOT NULL,
                            modified         DATETIME       NOT NULL,
                            modified_on_disk DATETIME       NOT NULL,
                            file             VARCHAR (2048) NOT NULL UNIQUE
                        );
                        `
                    )
                    .return().done ?? false
            );
        });
    }

    addArticle(p: Omit<ArticleInsertRow, "id">) {
        return err(() => {
            this.db.query(
                `INSERT INTO article 
                    (hash, created, modified, modified_on_disk, file) 
                    VALUES(?, ?, ?, ?, ?) 
                ON CONFLICT(file) DO 
                UPDATE SET 
                    hash = excluded.hash,
                    created = excluded.created,
                    modified = excluded.modified,
                    modified_on_disk = excluded.modified_on_disk
                `,
                [p.hash, p.created, p.modified, p.modified_on_disk, p.file]
            );

            // const [lid] = this.db.query("SELECT last_insert_rowid()");
            return +this.db.lastInsertRowId;
        });
    }

    hasArticle(file: string, modified_on_disk: Date) {
        return true;
    }

    cleanOldArticles(existingArticleFiles: string[]) {
        const questionmarks = existingArticleFiles.map(() => "?").join(",");
        return err(() => {
            return this.db.query(
                `DELETE FROM article WHERE file NOT IN (${questionmarks})`,
                existingArticleFiles
            );
        });
    }

    getArticlesFrom(modified_on_disk_start: Date) {
        return err(() => {
            const foo = this.db.query(
                "SELECT * FROM article WHERE modified_on_disk > :modified_on_disk_start",
                {
                    modified_on_disk_start,
                }
            );
            return [...mapStarArticle(foo)];
        });
    }

    getArticleMaxModifiedOnDisk() {
        return err(() => {
            const foo = this.db.query("SELECT MAX(modified_on_disk) FROM article");
            const values = [...foo];
            if (!values) {
                throw new Error("No articles");
            }
            const date = new Date(values[0]);
            if (date.toString() !== "Invalid Date") {
                return date;
            }
            return null;
        });
    }

    close() {
        this.db.close();
    }
}
