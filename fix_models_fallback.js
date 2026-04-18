import fs from 'fs';
import path from 'path';

const componentsDir = path.join(process.cwd(), 'components');

function replaceInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('gemini-1.5-pro')) {
        const newContent = content.replace(/gemini-1.5-pro/g, 'gemini-1.5-flash');
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`Fixed model reference in ${path.basename(filePath)}`);
    }
}

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            replaceInFile(fullPath);
        }
    }
}

scanDir(componentsDir);
console.log('Model fallback completed.');
