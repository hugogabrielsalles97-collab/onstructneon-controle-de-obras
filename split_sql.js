const fs = require('fs');
const path = require('path');

const filePath = './restore_data.sql';

const sql = fs.readFileSync(filePath, 'utf8');
const lines = sql.split('\n');

let chunk = [];
let counter = 1;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    chunk.push(line);
    if (line.trim().endsWith(');')) {
        const chunkPath = `./restore_chunk_${counter}.sql`;
        fs.writeFileSync(chunkPath, chunk.join('\n'), 'utf8');
        console.log(`Created ${chunkPath}`);
        chunk = [];
        counter++;
    }
}

if (chunk.length > 0) {
    const chunkPath = `./restore_chunk_${counter}.sql`;
    fs.writeFileSync(chunkPath, chunk.join('\n'), 'utf8');
    console.log(`Created final chunk: ${chunkPath}`);
}
