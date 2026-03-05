import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wnsiwqurkesrnpvlefyc.supabase.co';
const supabaseAnonKey = 'sb_publishable_EHpOAwJFSGLJK6tQqN-eAw_HPyKl-ii';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrate() {
    console.log('--- Iniciando Migração de Fotos (v2) ---');

    // Buscar todas as tarefas
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, photos');

    if (error) {
        console.error('Erro ao buscar tarefas:', error);
        return;
    }

    // Filtrar tarefas que realmente têm fotos em Base64
    const tasksWithPhotos = tasks.filter(t =>
        Array.isArray(t.photos) &&
        t.photos.some(p => typeof p === 'string' && p.startsWith('data:image'))
    );

    console.log(`Encontradas ${tasksWithPhotos.length} tarefas com fotos para migrar.`);

    for (const task of tasksWithPhotos) {
        let hasChanges = false;
        const newPhotos = [];

        for (const photo of task.photos) {
            if (typeof photo === 'string' && photo.startsWith('data:image')) {
                console.log(`Migrando foto da tarefa ${task.id}...`);
                try {
                    const mimeType = photo.split(';')[0].split(':')[1];
                    const base64Data = photo.split(',')[1];
                    const buffer = Buffer.from(base64Data, 'base64');

                    const fileExt = mimeType.split('/')[1] || 'jpg';
                    const fileName = `migrated-${task.id}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('task-photos')
                        .upload(fileName, buffer, {
                            contentType: mimeType,
                            upsert: true
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('task-photos')
                        .getPublicUrl(fileName);

                    newPhotos.push(publicUrl);
                    hasChanges = true;
                } catch (err) {
                    console.error(`Erro na tarefa ${task.id}:`, err.message);
                    newPhotos.push(photo);
                }
            } else {
                newPhotos.push(photo);
            }
        }

        if (hasChanges) {
            const { error: updateError } = await supabase
                .from('tasks')
                .update({ photos: newPhotos })
                .eq('id', task.id);

            if (updateError) {
                console.error(`Erro ao atualizar banco na tarefa ${task.id}:`, updateError.message);
            } else {
                console.log(`✔️ Tarefa ${task.id} migrada com sucesso.`);
            }
        }
    }
    console.log('--- Migração Concluída com Sucesso! ---');
}

migrate();
