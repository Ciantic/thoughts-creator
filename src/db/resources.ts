import type { DB } from "https://deno.land/x/sqlite/mod.ts";
import type { Rows } from "https://deno.land/x/sqlite/src/rows.ts";
import { dbError, fields, upsert } from "./helpers.ts";

export interface ResourceRow {
    id: number;
    modified_on_disk: Date;
    local_path: string;
    server_path: string;
}

type ResourceInsertRow = Omit<ResourceRow, "id">;

const f = fields<ResourceRow>();
const table = "resource";

function* mapStar(rows: Rows): Generator<ResourceRow> {
    for (const [id, modified_on_disk, file, server_path] of rows) {
        yield {
            id: +id,
            modified_on_disk: new Date(modified_on_disk),
            local_path: file,
            server_path: server_path,
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
                ${f.modified_on_disk} DATETIME       NOT NULL,
                ${f.local_path}       VARCHAR (2048) NOT NULL UNIQUE,
                ${f.server_path}      VARCHAR (2048) NOT NULL UNIQUE
            );
            `
        );
    }

    add = upsert<ResourceInsertRow>({
        table: table,
        conflict: f.local_path,
        args: [f.modified_on_disk, f.local_path, f.server_path],
        db: this.db,
    });

    getAll() {
        return dbError(() => {
            const q = this.db.query(`SELECT * FROM ${table}`);
            return [...mapStar(q)];
        });
    }
    getFrom(modified_on_disk_start: Date) {
        return dbError(() => {
            return [
                ...mapStar(
                    this.db.query(
                        `SELECT * FROM ${table} WHERE ${f.modified_on_disk} > :modified_on_disk_start`,
                        {
                            modified_on_disk_start,
                        }
                    )
                ),
            ];
        });
    }
}
