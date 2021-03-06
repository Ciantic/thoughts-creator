import { DB, Rows } from "./deps.ts";
import { dbError, fields, upsert } from "./helpers.ts";

export interface ArticleRow {
    id: number;
    hash: string;
    created: Date;
    modified: Date;
    modifiedOnDisk: Date;
    localPath: string;
    serverPath: string;
    title: string;
    html: string;
}

export type ArticleInsertRow = Omit<ArticleRow, "id">;

const f = fields<ArticleRow>();
const table = "article";

/**
 * `SELECT * FROM table` result mapper
 */
function* mapStar(rows: Rows): Generator<ArticleRow> {
    for (const [
        id,
        hash,
        created,
        modified,
        modifiedOnDisk,
        file,
        serverPath,
        title,
        html,
    ] of rows) {
        yield {
            id: +id,
            hash: hash,
            created: new Date(created),
            modified: new Date(modified),
            modifiedOnDisk: new Date(modifiedOnDisk),
            localPath: file,
            serverPath: serverPath,
            title: title,
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
                ${f.modifiedOnDisk}   DATETIME       NOT NULL,
                ${f.localPath}        VARCHAR (2048) NOT NULL UNIQUE,
                ${f.serverPath}       VARCHAR (2048) NOT NULL UNIQUE,
                ${f.title}            VARCHAR (2048) NOT NULL DEFAULT "",
                ${f.html}             VARCHAR (10048) NOT NULL DEFAULT ""
            );
            `
        );
    }

    add(values: ArticleInsertRow) {
        return upsert({
            values,
            db: this.db,
            table: table,
            conflict: f.localPath,
            args: [
                f.hash,
                f.created,
                f.modified,
                f.modifiedOnDisk,
                f.localPath,
                f.serverPath,
                f.title,
                f.html,
            ],
        });
    }

    cleanNonExisting(existingArticleFiles: string[]) {
        const questionmarks = existingArticleFiles.map(() => "?").join(",");
        return dbError(() => {
            return this.db.query(
                `DELETE FROM ${table} WHERE ${f.localPath} NOT IN (${questionmarks})`,
                existingArticleFiles
            );
        });
    }

    getAll() {
        return dbError(() => {
            const q = this.db.query(`SELECT * FROM ${table}`);
            return [...mapStar(q)];
        });
    }

    getFrom(fromModifiedOnDisk: Date) {
        return dbError(() => {
            const q = this.db.query(
                `SELECT * FROM ${table} WHERE ${f.modifiedOnDisk} > :fromModifiedOnDisk`,
                {
                    fromModifiedOnDisk,
                }
            );
            return [...mapStar(q)];
        });
    }

    getMaxModifiedOnDisk() {
        return dbError(() => {
            const [maxdate] = [...this.db.query(`SELECT MAX(${f.modifiedOnDisk}) FROM ${table}`)];
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
