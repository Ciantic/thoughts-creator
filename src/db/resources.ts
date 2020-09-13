import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { Rows } from "https://deno.land/x/sqlite@v2.3.0/src/rows.ts";
import { dbError } from "./helpers.ts";

export interface ResourceRow {
    id: number;
    modified_on_disk: Date;
    file: string;
    server_path: string;
}

type ResourceInsertRow = Omit<ResourceRow, "id">;

function* mapStar(rows: Rows): Generator<ResourceRow> {
    for (const [id, modified_on_disk, file, server_path] of rows) {
        yield {
            id: +id,
            modified_on_disk: new Date(modified_on_disk),
            file: file,
            server_path: server_path,
        };
    }
}

export class ResourceRepository {
    constructor(private db: DB) {}

    createSchema() {
        this.db.query(
            `
            CREATE TABLE IF NOT EXISTS resource (
                id               INTEGER   PRIMARY KEY AUTOINCREMENT NOT NULL,
                modified_on_disk DATETIME       NOT NULL,
                file             VARCHAR (2048) NOT NULL UNIQUE,
                server_path        VARCHAR (2048) NOT NULL UNIQUE
            );
            `
        );
    }

    add(p: ResourceInsertRow) {
        return dbError(() => {
            this.db.query(
                `INSERT INTO resource 
                    (modified_on_disk, file, server_path) 
                    VALUES(?, ?, ?) 
                ON CONFLICT(file) DO 
                UPDATE SET 
                    modified_on_disk = excluded.modified_on_disk,
                    server_path = excluded.server_path
                `,
                [p.modified_on_disk, p.file, p.server_path]
            );

            return +this.db.lastInsertRowId;
        });
    }

    getFrom(modified_on_disk_start: Date) {
        return dbError(() => {
            return [
                ...mapStar(
                    this.db.query(
                        "SELECT * FROM resource WHERE modified_on_disk > :modified_on_disk_start",
                        {
                            modified_on_disk_start,
                        }
                    )
                ),
            ];
        });
    }
}
