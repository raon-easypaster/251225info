const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'archiveData.js');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('scripts') && !file.includes('data')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.html') && !file.endsWith('index.html')) {
                results.push(file);
            }
        }
    });
    return results;
}

function extractMetadata(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);

    // Date from filename: YYMMDD
    let dateStr = "";
    const dateMatch = fileName.match(/^(\d{2})(\d{2})(\d{2})/);
    if (dateMatch) {
        dateStr = `20${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }

    // Title
    const titleMatch = content.match(/<title>(.*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : "제목 없음";

    // Remove prefixes like "비주얼 매거진: "
    title = title.replace(/^비주얼 매거진:\s*/, "");
    // Remove suffix like " - 2026 송구영신예배"
    title = title.replace(/\s*-\s*\d{4}\s+.*$/, "");

    // Scripture
    let scripture = "";

    // Helper to clean extracted text
    const cleanText = (text) => {
        if (!text) return "";
        return text
            .replace(/<br\s*\/?>/gi, " ") // Replace <br> with space first
            .replace(/<[^>]*>/g, "")     // Remove remaining HTML tags
            .replace(/\n+/g, " ")        // Replace newlines with space
            .replace(/\s\s+/g, " ")      // Collapse multiple spaces
            .trim();
    };

    // 1. data-scripture attribute
    const dataScriptureMatch = content.match(/data-scripture="([^"]+)"/);
    if (dataScriptureMatch) {
        scripture = dataScriptureMatch[1];
    }

    if (!scripture) {
        // 2. scripture-ref class (more specific than subtitle)
        const scriptureRefMatch = content.match(/class="scripture-ref"[^>]*>([\s\S]*?)(?:<\/span>|<\/div>)/i);
        if (scriptureRefMatch) {
            scripture = cleanText(scriptureRefMatch[1]);
        }
    }

    if (!scripture) {
        // 3. SERMON INFOGRAPHIC pattern (e.g., 260111info.html)
        const sermonInfoMatch = content.match(/SERMON INFOGRAPHIC\s*•\s*([\s\S]*?)(?:<\/div>|<\/span>)/i);
        if (sermonInfoMatch) {
            scripture = cleanText(sermonInfoMatch[1]);
        }
    }

    if (!scripture) {
        // 4. subtitle class (e.g., 260118info.html)
        const subtitleMatch = content.match(/class="subtitle"[^>]*>([\s\S]*?)<\/div>/i);
        if (subtitleMatch) {
            scripture = cleanText(subtitleMatch[1]);
        }
    }

    if (!scripture) {
        // 5. bible-box pattern (older files)
        const bibleBoxMatch = content.match(/<div class="bible-box">[\s\S]*?<p>([\s\S]*?)<\/p>/i);
        if (bibleBoxMatch) {
            scripture = cleanText(bibleBoxMatch[1]);
            // Remove parenthetical references if they are multiline or trailing
            scripture = scripture.replace(/\s*\([\s\S]*?\)$/, "");
        }
    }

    if (!scripture) {
        // 6. fa-book-open icon pattern (e.g., 251231info.html)
        const bookIconMatch = content.match(/<i class="fase? fa-book-open[^>]*><\/i>\s*([\s\S]*?)(?:<\/span>|<\/div>)/i);
        if (bookIconMatch) {
            scripture = cleanText(bookIconMatch[1]);
        }
    }

    if (!scripture) {
        // 6. scripture-ref class (e.g., 251225info.html)
        const scriptureRefMatch = content.match(/class="scripture-ref"[^>]*>([\s\S]*?)(?:<\/span>|<\/div>)/i);
        if (scriptureRefMatch) {
            scripture = cleanText(scriptureRefMatch[1]);
        }
    }

    return {
        fileName,
        relativeURL: path.relative(ROOT_DIR, filePath),
        date: dateStr,
        title,
        scripture: cleanText(scripture)
    };
}

const htmlFiles = walk(ROOT_DIR);
const archiveData = htmlFiles.map(file => extractMetadata(file));

// Sort by date descending
archiveData.sort((a, b) => b.date.localeCompare(a.date));

const output = `window.ARCHIVE_DATA = ${JSON.stringify(archiveData, null, 2)};`;

fs.writeFileSync(DATA_FILE, output);
console.log(`Generated ${DATA_FILE} with ${archiveData.length} entries.`);
