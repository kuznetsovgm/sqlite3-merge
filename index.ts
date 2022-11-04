import sqlite3 from "sqlite3";
import { Database, open } from 'sqlite';
import * as fs from 'fs/promises';
import * as path from 'path';
import commandLineArgs, { OptionDefinition } from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import { ISqliteMaster } from "./types";

const DB_EXT = ['db', 'sqlite'];
const DEFAULT_TARGET_DB = './result.db';
const SQLITE_MAX_VARIABLES = 32766;
const optionDefinitions: (OptionDefinition & commandLineUsage.OptionDefinition)[] = [
    { name: 'source', type: String, multiple: true, alias: 's', defaultOption: true, defaultValue: '.', description: `The folder containing the databases. Can be specify multiple. Default value: '.'`, typeLabel: '{underline file/folder}' },
    { name: 'destination', type: String, alias: 'd', defaultValue: DEFAULT_TARGET_DB, description: `The database where the tables will be copied. If it does not exist, it will be created. Default value: '${DEFAULT_TARGET_DB}'`, typeLabel: '{underline file}' },
    { name: 'extension', type: String, lazyMultiple: true, alias: 'e', defaultValue: DB_EXT, description: `Database extensions. Can be specify multiple. Default value: [${DB_EXT.join(',')}]`, typeLabel: '{underline db}' },
    { name: 'table', type: String, lazyMultiple: true, alias: 't', defaultValue: [], description: `Tables to copy. Can be specify multiple. By default copies all tables.`, typeLabel: '{underline table_name}' },
    { name: 'help', type: Boolean, alias: 'h', description: 'Print this help message' },
];

async function searchDbs(root: string, extensions: string[]): Promise<string[]> {
    const p = path.resolve(root);
    
    const stat = await fs.stat(p);
    if (!stat.isDirectory()) {
        const ext = p.match(/(?<=\.)[a-zA-Z0-9"'\-_+=)(*&^%$#@!]+$/i)?.at(0);
        return !!ext && extensions.includes(ext) ? [p] : [];
    }
    console.log(`search db's in ${p.toString()}`);
    const dir = await fs.readdir(p)
    return (await Promise.all(dir.map(async (val) => (await searchDbs(path.resolve(p, val), extensions))))).flat();
}

async function joinDb(file: string, targetDb: Database<sqlite3.Database, sqlite3.Statement>, tables?: string[]): Promise<number> {
    const db = await open({
        filename: file,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY,
    });
    const dbTables = await db.all<ISqliteMaster[]>(`SELECT * FROM sqlite_master WHERE type IN(?) AND name NOT LIKE 'sqlite_%';`, 'table');
    await Promise.allSettled(dbTables.filter(table => !!tables?.length ? tables.includes(table.tbl_name) : true).map(async (table) => {
        try {
            console.log(`Copy ${table.tbl_name} from ${file}`)
            await targetDb.run(table.sql.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'));
            const data = await db.all(`SELECT * FROM ${table.tbl_name};`);
            if (!data.length) {
                return;
            }
            const pieceSize = Math.floor(SQLITE_MAX_VARIABLES / Object.keys(data[0]).length);
            for (let i = 0; i < data.length; i) {
                const piece = data.slice(i, i += pieceSize);
                const values = piece.map(val => Object.values(val)).flat();
                // console.log(values);

                const sql = `INSERT OR IGNORE INTO ${table.tbl_name} (${Object.keys(piece[0]).join(',')}) VALUES ${piece.map(val => `(${Object.keys(val).fill('?')})`).join(',')};`;
                // console.log(sql);
                await targetDb.run(sql, values);
            }
        } catch (e) {
            console.error(e);
        }
    }));
    
    await db.close();
    return dbTables.length;
}

async function printHelp(options: OptionDefinition[]) {
    const sections = [
        {
          header: 'Split databases',
          content: 'Copies tables from multiple sqlite databases into one.'
        },
        {
          header: 'Usage example',
          content: '$ {bold ./splitdb} [{bold -d} {underline result.db}] [{bold -e} {underline .db}] [{bold -e} {underline .sqlite}] [{bold -t} {underline USERS}] [{bold -t} {underline POSTS}] {underline ./databases ./download}'
        },
        {
          header: 'Options',
          optionList: options
        }
    ]
    const usage = commandLineUsage(sections);
    console.log(usage);
}

async function main() {
    const startDate = Date.now();
    const options = commandLineArgs(optionDefinitions);
    if (options.help) {
        return printHelp(optionDefinitions);
    }
    
    const dbs: string[] = (await Promise.all(options.source.map((src: string) => searchDbs(src, options.extension.map((ext: string) => ext.replace('.', '')))))).flat();
    
    console.log(`Found ${dbs.length} databases`);
    let tablesCount = 0;

    const targetDb = await open({
        filename: path.resolve(options.destination),
        driver: sqlite3.Database,
    });
    
    await Promise.all(dbs.map(file => joinDb(file, targetDb, options.table).then(res => tablesCount += res)));
    
    await targetDb.close();

    console.log(`\n\n${path.resolve(options.destination)}\nCopied ${tablesCount} tables from ${dbs.length} databases in ${(Date.now() - startDate) / 1000}seconds.`);
    
}

main();
