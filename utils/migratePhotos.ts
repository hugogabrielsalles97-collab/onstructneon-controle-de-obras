import { supabase } from '../supabaseClient';

/**
 * Verifica se existem fotos em Base64 no banco e as migra para o Supabase Storage.
 * Retorna resultado detalhado.
 */
export const migratePhotosToStorage = async (
    onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; migrated: number; errors: any[] }> => {
    let migratedCount = 0;
    const errors: any[] = [];

    try {
        // Obter contagem total de tarefas para paginação e progresso
        const { count, error: countError } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true });

        if (countError) throw countError;
        if (!count || count === 0) return { success: true, migrated: 0, errors: [] };

        const pageSize = 10;
        let offset = 0;
        let hasMore = true;
        let processedTasks = 0;

        while (hasMore) {
            // Busca apenas 10 tarefas por vez, trazendo as fotos para não estourar memória do Supabase
            const { data: tasks, error: fetchError } = await supabase
                .from('tasks')
                .select('id, photos')
                .range(offset, offset + pageSize - 1);

            if (fetchError) throw fetchError;
            if (!tasks || tasks.length === 0) {
                hasMore = false;
                break;
            }

            const tasksWithBase64 = tasks.filter(t =>
                Array.isArray(t.photos) &&
                t.photos.some((p: string) => typeof p === 'string' && p.startsWith('data:image'))
            );

            for (let i = 0; i < tasksWithBase64.length; i++) {
                const task = tasksWithBase64[i];
                const photos = task.photos as string[];
                let hasChanges = false;
                const newPhotos: string[] = [];

                if (onProgress) onProgress(processedTasks + i + 1, count);

                for (const photo of photos) {
                    // Se for Base64 (começa com data:image)
                    if (photo.startsWith('data:image')) {
                        try {
                            const mimeType = photo.split(';')[0].split(':')[1];
                            const base64Data = photo.split(',')[1];

                            // Converter Base64 para Blob
                            const byteCharacters = atob(base64Data);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let j = 0; j < byteCharacters.length; j++) {
                                byteNumbers[j] = byteCharacters.charCodeAt(j);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: mimeType });

                            // Gerar nome único
                            const fileExt = mimeType.split('/')[1] || 'jpg';
                            const fileName = `migrated-${task.id}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

                            // Upload para Storage
                            const { error: uploadError } = await supabase.storage
                                .from('task-photos')
                                .upload(fileName, blob, {
                                    contentType: mimeType,
                                    upsert: true
                                });

                            if (uploadError) throw uploadError;

                            // Obter URL pública
                            const { data: { publicUrl } } = supabase.storage
                                .from('task-photos')
                                .getPublicUrl(fileName);

                            newPhotos.push(publicUrl);
                            hasChanges = true;
                            migratedCount++;
                        } catch (err) {
                            console.error(`Erro ao migrar foto da tarefa ${task.id}:`, err);
                            errors.push({ taskId: task.id, error: err });
                            newPhotos.push(photo); // Mantém a original em caso de erro
                        }
                    } else {
                        // Já é uma URL, mantém como está
                        newPhotos.push(photo);
                    }
                }

                // 2. Se houve migração, atualizar a tarefa no banco
                if (hasChanges) {
                    const { error: updateError } = await supabase
                        .from('tasks')
                        .update({ photos: newPhotos })
                        .eq('id', task.id);

                    if (updateError) {
                        errors.push({ taskId: task.id, updateError });
                    }
                }
            } // Fim do for de tarefas que tem base64

            processedTasks += tasks.length;
            if (onProgress) onProgress(processedTasks, count);
            offset += pageSize;
        } // Fim do while

        return { success: true, migrated: migratedCount, errors };
    } catch (error) {
        console.error('Falha crítica na migração:', error);
        return { success: false, migrated: migratedCount, errors: [error] };
    }
};

/**
 * Migração automática silenciosa — roda em background após login.
 * Não bloqueia a interface, não mostra erros ao usuário.
 * Apenas loga no console.
 */
let migrationAlreadyRan = false;

export const runAutoMigration = async (): Promise<void> => {
    // Impede que rode mais de uma vez por sessão
    if (migrationAlreadyRan) return;
    migrationAlreadyRan = true;

    try {
        console.log('[AutoMigration] Verificando fotos em Base64 no banco...');

        const result = await migratePhotosToStorage();

        if (result.migrated > 0) {
            console.log(`[AutoMigration] ✅ ${result.migrated} foto(s) migrada(s) para o Storage com sucesso!`);
        } else {
            console.log('[AutoMigration] ✅ Nenhuma foto em Base64 encontrada. Tudo já está no Storage.');
        }

        if (result.errors.length > 0) {
            console.warn(`[AutoMigration] ⚠️ ${result.errors.length} erro(s) durante a migração:`, result.errors);
        }
    } catch (err) {
        console.warn('[AutoMigration] Erro inesperado na migração automática:', err);
    }
};
