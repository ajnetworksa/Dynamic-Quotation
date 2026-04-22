const Database = require('better-sqlite3');
const fs = require('fs');

async function reconstruct() {
    console.log('--- Starting Ultimate Quote Reconstruction ---');
    
    const db = new Database('quotes.db');
    db.pragma('foreign_keys = OFF');

    try {
        // 1. Wipe the corrupted quotes table
        console.log('Clearing corrupted quotes table...');
        db.prepare("DELETE FROM quotes").run();

        // 2. Find all unique quote_ids in items
        const itemQuotes = db.prepare("SELECT DISTINCT quote_id FROM quote_items").all();
        console.log(`Found ${itemQuotes.length} unique Quote IDs to restore.`);

        let restoredCount = 0;
        const insertStmt = db.prepare(`
            INSERT INTO quotes (quote_id, date, subtotal, tax, grand_total, status, subject, updated_at, markup, vat_rate, type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of itemQuotes) {
            const quoteId = item.quote_id;
            
            // Calculate totals
            const stats = db.prepare("SELECT SUM(net_price) as total FROM quote_items WHERE quote_id = ?").get(quoteId);
            const subtotal = stats.total || 0;
            const vat = subtotal * 0.15;
            const grandTotal = subtotal + vat;

            // Try to find any clue about the customer or date in the activity log
            const log = db.prepare("SELECT timestamp, action FROM activity_log WHERE quote_id = ? ORDER BY timestamp ASC").get(quoteId);
            const date = log ? log.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
            
            // We'll set a generic subject since it was likely lost
            const subject = "Restored Quote";

            try {
                insertStmt.run(
                    quoteId,
                    date,
                    subtotal,
                    vat,
                    grandTotal,
                    'Restored',
                    subject,
                    new Date().toISOString(),
                    8, // default markup
                    15, // default vat
                    'Quotation'
                );
                restoredCount++;
            } catch (e) {
                // Skip if duplicate (shouldn't happen with string ID)
            }
        }
        
        console.log(`✅ Successfully reconstructed ${restoredCount} headers.`);
        
        // Final check
        const totalItems = db.prepare("SELECT COUNT(*) as count FROM quote_items").get().count;
        console.log(`Total line items preserved: ${totalItems}`);

    } catch (err) {
        console.error('Reconstruction error:', err.message);
    }
    
    db.close();
    console.log('--- Reconstruction Finished ---');
}

reconstruct();
