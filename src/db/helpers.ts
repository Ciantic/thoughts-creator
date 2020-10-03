import type { DB } from "https://deno.land/x/sqlite/mod.ts";

export function dbError<T>(f: () => T) {
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

export function fields<T>() {
    return new Proxy(
        {},
        {
            get: function (target, prop, receiver) {
                return prop;
            },
        }
    ) as {
        [P in keyof T]: P;
    };
}

export function upsert<T>({
    db,
    table,
    conflict: conflict_sql,
    args,
}: {
    db: DB;
    table: string;
    conflict: keyof T;
    args: (keyof T)[];
}) {
    const names_sql = args.join(",");
    const values_sql = args.map(() => "?").join(",");
    const update_fields_sql = args.map((f) => `${f} = excluded.${f}`).join(",");
    const sql = `
        INSERT INTO ${table} (${names_sql}) VALUES(${values_sql})
        ON CONFLICT(${conflict_sql}) DO
        UPDATE SET ${update_fields_sql}
    `;
    return (values: T) =>
        dbError(() => {
            db.query(
                sql,
                args.map((f) => values[f])
            );

            return +db.lastInsertRowId;
        });
}

// export interface ArticleRow {
//     id: number;
//     hash: string;
//     created: Date;
//     modified: Date;
//     modified_on_disk: Date;
//     local_path: string;
//     server_path: string;
//     html: string;
// }

// function upsertExample(db: DB) {
//     const f = fields<ArticleRow>();
//     return upsert<ArticleRow>(db, "article", f.local_path, f.created);
// }
