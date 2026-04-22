const Database = require('better-sqlite3');
const fs = require('fs');

async function reconstruct() {
    console.log('--- Starting Quote Header Reconstruction ---');
    
    // 1. Move the recovered file to become the main DB
    if (fs.existsSync('quotes.db')) {
        const timestamp = Date.now();
        fs.renameSync('quotes.db', `quotes.db.corrupt_${timestamp}`);
    }
    fs.copyFileSync('quotes_recovered_final.db', 'quotes.db');

    const db = new Database('quotes.db');
    db.pragma('foreign_keys = OFF');

    try {
        // Clean up the "scrambled" quotes that are actually products
        // (We can identify them because their quote_id or date fields contain product-like strings)
        console.log('Cleaning up scrambled headers...');
        const deleteStmt = db.prepare("DELETE FROM quotes WHERE quote_id LIKE '%Dahua%' OR quote_id LIKE '%Hikvision%' OR date = 'pc' OR date = 'set'");
        const deleteInfo = deleteStmt.run();
        console.log(`  - Deleted ${deleteInfo.changes} corrupted header rows.`);

        // Find all unique quote_ids in items that are missing headers
        const itemQuotes = db.prepare("SELECT DISTINCT quote_id FROM quote_items").all();
        console.log(`Found ${itemQuotes.length} unique Quote IDs in the items table.`);

        let restoredCount = 0;
        for (const item of itemQuotes) {
            const quoteId = item.quote_id;
            const existing = db.prepare("SELECT id FROM quotes WHERE quote_id = ?").get(quoteId);
            
            if (!existing) {
                // Reconstruct from items
                const itemStats = db.prepare("SELECT SUM(net_price) as subtotal, COUNT(*) as count FROM quote_items WHERE quote_id = ?").get(quoteId);
                const subtotal = itemStats.subtotal || 0;
                
                // Try to find a date in activity_log
                const activity = db.prepare("SELECT timestamp FROM activity_log WHERE quote_id = ? ORDER BY timestamp ASC").get(quoteId);
                const date = activity ? activity.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
                
                // Insert "ghost" header
                try {
                    db.prepare(`
                        INSERT INTO quotes (quote_id, date, subtotal, tax, grand_total, status, subject, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        quoteId, 
                        date, 
                        subtotal, 
                        subtotal * 0.15, 
                        subtotal * 1.15, 
                        'Restored', 
                        'Restored from corruption',
                        new Date().toISOString()
                    );
                    restoredCount++;
                } catch (e) {
                    // console.error(`  - Failed to restore ${quoteId}:`, e.message);
                }
            }
        }
        console.log(`✅ Successfully reconstructed ${restoredCount} quote headers.`);

    } catch (err) {
        console.error('Reconstruction error:', err.message);
    }
    
    db.close();
    console.log('--- Reconstruction Finished ---');
}

reconstruct();
