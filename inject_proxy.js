import fs from 'fs';
import path from 'path';

const componentsDir = path.join(process.cwd(), 'components');

const fetchInjectionStr = `
const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
    // Import do supabase cliente dinâmico para garantir que tem acesso onde estiver
    const { supabase } = await import('../supabaseClient');
    const { data, error } = await supabase.rpc('gemini_proxy', {
        request_url: url.toString(),
        request_body: options?.body ? JSON.parse(options.body as string) : {}
    });
    if (error) {
        console.error("Erro no Proxy:", error);
        throw new Error(error.message);
    }
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};
`;

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Find GoogleGenerativeAI instantiations and append the fetch option
    if (content.includes('new GoogleGenerativeAI(') && !content.includes('customFetch')) {
        // Find the last import statment to inject our customFetch block
        const lastImportIndex = content.lastIndexOf('import ');
        let endOfLastImport = content.indexOf('\n', lastImportIndex);
        
        content = content.slice(0, endOfLastImport + 1) + fetchInjectionStr + content.slice(endOfLastImport + 1);
        
        // Replace all genAI instantiations
        // const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
        // Replace with:
        // const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY, { fetch: customFetch });
        
        content = content.replace(/new GoogleGenerativeAI\(([^,)]+)\)/g, 'new GoogleGenerativeAI($1, { fetch: customFetch } as any)');
        
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Injected secure proxy bypass in ${path.basename(filePath)}`);
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
console.log('Proxy injections completed.');
