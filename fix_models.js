import fs from 'fs';
import path from 'path';

const componentsDir = path.join(process.cwd(), 'components');

function replaceInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('gemini-2.5-flash')) {
        const newContent = content.replace(/gemini-2.5-flash/g, 'gemini-1.5-pro');
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`Updated model in ${path.basename(filePath)}`);
    }
    // Also update 2.0-flash to 1.5-pro to uniformize on their Pro plan
    if (content.includes('gemini-2.0-flash')) {
        const newContent = content.replace(/gemini-2.0-flash/g, 'gemini-1.5-pro');
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`Updated 2.0-flash model in ${path.basename(filePath)}`);
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
console.log('Model fixes completed.');
