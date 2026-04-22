const Database = require('better-sqlite3');
const fs = require('fs');

async function repair() {
    console.log('--- Starting Database Repair (Ultimate Aggression) ---');
    
    const RECOVERED_FILE = 'quotes_recovered_final.db';
    if (fs.existsSync(RECOVERED_FILE)) {
        fs.unlinkSync(RECOVERED_FILE);
    }

    const db = new Database('quotes.db');
    const newDb = new Database(RECOVERED_FILE);
    newDb.pragma('foreign_keys = OFF');

    try {
        const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        
        for (const table of tables) {
            console.log(`Recovering table: ${table.name}...`);
            try {
                newDb.exec(table.sql);
            } catch (e) {}
            
            let count = 0;
            let failCount = 0;
            const seenIds = new Set();

            // Strategy 1: Rowid iteration (ignores primary key index)
            console.log(`  - Trying Rowid iteration...`);
            for (let i = 1; i <= 20000; i++) {
                try {
                    const row = db.prepare(`SELECT * FROM ${table.name} WHERE _rowid_ = ?`).get(i);
                    if (row) {
                        const columns = Object.keys(row);
                        const placeholders = columns.map(() => '?').join(',');
                        const insert = newDb.prepare(`INSERT OR IGNORE INTO ${table.name} (${columns.join(',')}) VALUES (${placeholders})`);
                        const info = insert.run(Object.values(row));
                        if (info.changes > 0) {
                            count++;
                            if (row.id) seenIds.add(row.id);
                        }
                    }
                } catch (err) {
                    failCount++;
                }
            }

            // Strategy 2: ID-based iteration (if table has an 'id' column)
            console.log(`  - Trying ID-based iteration (current count: ${count})...`);
            for (let i = 1; i <= 20000; i++) {
                if (seenIds.has(i)) continue;
                try {
                    const row = db.prepare(`SELECT * FROM ${table.name} WHERE id = ?`).get(i);
                    if (row) {
                        const columns = Object.keys(row);
                        const placeholders = columns.map(() => '?').join(',');
                        const insert = newDb.prepare(`INSERT OR IGNORE INTO ${table.name} (${columns.join(',')}) VALUES (${placeholders})`);
                        const info = insert.run(Object.values(row));
                        if (info.changes > 0) {
                            count++;
                        }
                    }
                } catch (err) {
                    failCount++;
                }
            }

            // Strategy 3: Offset-based iteration
            console.log(`  - Trying Offset-based iteration (current count: ${count})...`);
            for (let i = 0; i < 10000; i++) {
                try {
                    const row = db.prepare(`SELECT * FROM ${table.name} LIMIT 1 OFFSET ?`).get(i);
                    if (!row) break;
                    const columns = Object.keys(row);
                    const placeholders = columns.map(() => '?').join(',');
                    const insert = newDb.prepare(`INSERT OR IGNORE INTO ${table.name} (${columns.join(',')}) VALUES (${placeholders})`);
                    const info = insert.run(Object.values(row));
                    if (info.changes > 0) {
                        count++;
                    }
                } catch (err) {
                    failCount++;
                }
            }

            console.log(`  - Recovered ${count} rows from ${table.name}.`);
        }
    } catch (err) {
        console.error('Global error:', err.message);
    }
    
    newDb.pragma('foreign_keys = ON');
    db.close();
    newDb.close();
    console.log('--- Repair Finished ---');
}

repair();
