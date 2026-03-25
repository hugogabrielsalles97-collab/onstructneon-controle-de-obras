import fs from 'fs';
import path from 'path';

const componentsDir = path.join(process.cwd(), 'components');

const fetchMonkeyPatchStr = `
// Interceptor temporário e blindado do fetch para a Google API
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (urlStr.includes('generativelanguage.googleapis.com')) {
        const { supabase } = await import('../supabaseClient');
        const { data, error } = await supabase.rpc('gemini_proxy', {
            request_url: urlStr,
            request_body: init?.body ? JSON.parse(init.body) : {}
        });
        
        if (error) {
            console.error("Erro no Proxy:", error);
            return new Response(JSON.stringify({ error: { message: error.message } }), { status: 500, headers: { 'Content-Type': 'application/json' }});
        }
        
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    return originalFetch(input, init);
};
`;

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Remove the old customFetch block
    if (content.includes('const customFetch = async')) {
        const fetchBlockStart = content.indexOf('const customFetch = async');
        let fetchBlockEnd = content.indexOf('};', fetchBlockStart);
        if (fetchBlockEnd !== -1) {
            // Find the end of customFetch
            content = content.slice(0, fetchBlockStart) + content.slice(fetchBlockEnd + 2);
        }
    }
    
    // Un-inject { fetch: customFetch } as any
    content = content.replace(/\{ fetch: customFetch \}(\s*)as any/g, '{}');

    // Add the global monkey patch inside the function! No, inside the global scope of the file!
    if (content.includes('new GoogleGenerativeAI(') && !content.includes('originalFetch = globalThis.fetch')) {
        const lastImportIndex = content.lastIndexOf('import ');
        let endOfLastImport = content.indexOf('\n', lastImportIndex);
        
        content = content.slice(0, endOfLastImport + 1) + fetchMonkeyPatchStr + content.slice(endOfLastImport + 1);
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Injected global fetch proxy bypass in ${path.basename(filePath)}`);
    } else {
    	// It already has the un-inject applied
    	fs.writeFileSync(filePath, content, 'utf-8');
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
console.log('Proxy injections via global fetch completed.');
