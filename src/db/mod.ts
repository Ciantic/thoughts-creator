import { DB } from "./deps.ts";
import { ArticleRepository } from "./articles.ts";
import { ResourceRepository } from "./resources.ts";

export class DbContext {
    private db: DB;
    public articles: ArticleRepository;
    public resources: ResourceRepository;

    constructor(private dbFile: string) {
        this.db = new DB(dbFile);
        this.articles = new ArticleRepository(this.db);
        this.resources = new ResourceRepository(this.db);
    }

    createSchema() {
        this.db.query("PRAGMA default_temp_store = MEMORY;");
        this.articles.createSchema();
        this.resources.createSchema();
    }

    getDatabaseFile() {
        return this.dbFile;
    }

    close() {
        this.db.close();
    }
}
