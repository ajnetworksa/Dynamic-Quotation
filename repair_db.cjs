const Database = require('better-sqlite3');
const fs = require('fs');

async function repair() {
    console.log('--- Starting Database Repair (Aggressive) ---');
    
    if (fs.existsSync('quotes_recovered.db')) {
        fs.unlinkSync('quotes_recovered.db');
    }

    const db = new Database('quotes.db');
    const newDb = new Database('quotes_recovered.db');
    newDb.pragma('foreign_keys = OFF');

    try {
        const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        
        for (const table of tables) {
            console.log(`Recovering table: ${table.name}...`);
            try {
                newDb.exec(table.sql);
            } catch (e) {
                console.warn(`  - Schema error: ${e.message}`);
            }
            
            let count = 0;
            let failCount = 0;

            // Try to get max ID to know how far to loop
            let maxId = 10000; // Default guess
            try {
                const res = db.prepare(`SELECT max(id) as maxId FROM ${table.name}`).get();
                if (res && res.maxId) maxId = res.maxId;
            } catch (e) {}

            // Aggressive row-by-row recovery with LIMIT/OFFSET
            // This is slow but handles corruption in the middle of the table
            for (let i = 0; i <= maxId + 100; i++) {
                try {
                    // Try to fetch by ID directly (often bypasses index corruption)
                    const row = db.prepare(`SELECT * FROM ${table.name} WHERE id = ?`).get(i);
                    if (row) {
                        const columns = Object.keys(row);
                        const placeholders = columns.map(() => '?').join(',');
                        const insert = newDb.prepare(`INSERT INTO ${table.name} (${columns.join(',')}) VALUES (${placeholders})`);
                        insert.run(Object.values(row));
                        count++;
                    }
                } catch (err) {
                    // Row is corrupt, skip it
                    failCount++;
                }
            }
            
            // If ID-based fetch didn't find much, try OFFSET-based
            if (count === 0) {
                console.log(`  - ID-based failed, trying OFFSET-based for ${table.name}...`);
                for (let i = 0; i < 5000; i++) {
                    try {
                        const row = db.prepare(`SELECT * FROM ${table.name} LIMIT 1 OFFSET ?`).get(i);
                        if (!row) break; // End of table
                        const columns = Object.keys(row);
                        const placeholders = columns.map(() => '?').join(',');
                        const insert = newDb.prepare(`INSERT OR REPLACE INTO ${table.name} (${columns.join(',')}) VALUES (${placeholders})`);
                        insert.run(Object.values(row));
                        count++;
                    } catch (err) {
                        failCount++;
                    }
                }
            }

            console.log(`  - Recovered ${count} rows. (Failed/Skipped: ${failCount})`);
        }
    } catch (err) {
        console.error('Global error:', err.message);
    }
    
    console.log('Final integrity check:');
    try {
        console.log(newDb.prepare('PRAGMA integrity_check').get());
    } catch (e) {}

    db.close();
    newDb.close();
    console.log('--- Repair Finished ---');
}

repair();
