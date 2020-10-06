import type { DB } from "https://deno.land/x/sqlite/mod.ts";
import type { Rows } from "https://deno.land/x/sqlite/src/rows.ts";
import { dbError, fields, upsert } from "./helpers.ts";

export interface ResourceRow {
    id: number;
    modifiedOnDisk: Date;
    localPath: string;
    serverPath: string;
}

export type ResourceInsertRow = Omit<ResourceRow, "id">;

const f = fields<ResourceRow>();
const table = "resource";

/**
 * `SELECT * FROM table` result mapper
 */
function* mapStar(rows: Rows): Generator<ResourceRow> {
    for (const [id, modifiedOnDisk, file, serverPath] of rows) {
        yield {
            id: +id,
            modifiedOnDisk: new Date(modifiedOnDisk),
            localPath: file,
            serverPath: serverPath,
        };
    }
}

export class ResourceRepository {
    constructor(private db: DB) {}

    createSchema() {
        this.db.query(
            `
            CREATE TABLE IF NOT EXISTS ${table} (
                ${f.id}               INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
                ${f.modifiedOnDisk} DATETIME       NOT NULL,
                ${f.localPath}       VARCHAR (2048) NOT NULL UNIQUE,
                ${f.serverPath}      VARCHAR (2048) NOT NULL UNIQUE
            );
            `
        );
    }

    add = upsert<ResourceInsertRow>({
        table: table,
        conflict: f.localPath,
        args: [f.modifiedOnDisk, f.localPath, f.serverPath],
        db: this.db,
    });

    getAll() {
        return dbError(() => {
            const q = this.db.query(`SELECT * FROM ${table}`);
            return [...mapStar(q)];
        });
    }
    getFrom(fromModifiedOnDisk: Date) {
        return dbError(() => {
            return [
                ...mapStar(
                    this.db.query(
                        `SELECT * FROM ${table} WHERE ${f.modifiedOnDisk} > :fromModifiedOnDisk`,
                        {
                            fromModifiedOnDisk: fromModifiedOnDisk,
                        }
                    )
                ),
            ];
        });
    }
}
