
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataProvider';
import { useOrgMembers, useOrgMutations } from '../hooks/dataHooks';
import { OrgMember, User } from '../types';
import Header from './Header';
import Sidebar from './Sidebar';
import PlusIcon from './icons/PlusIcon';
import DeleteIcon from './icons/DeleteIcon';
import XIcon from './icons/XIcon';
import ManagementIcon from './icons/ManagementIcon';

interface OrgChartPageProps {
    onNavigateToHome: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToWarRoom: () => void;
    onNavigateToCost: () => void;
    onNavigateToPodcast: () => void;
    onNavigateToCheckoutSummary: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToVisualControl?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const OrgChartPage: React.FC<OrgChartPageProps> = (props) => {
    const { currentUser: user, allUsers, signOut } = useData();
    const { data: members = [] } = useOrgMembers();
    const { saveMember, deleteMember } = useOrgMutations();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<Partial<OrgMember> | null>(null);
    const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    const handleLogout = async () => {
        await signOut();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setStartY(e.pageY - scrollContainerRef.current.offsetTop);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
        setScrollTop(scrollContainerRef.current.scrollTop);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const y = e.pageY - scrollContainerRef.current.offsetTop;
        const walkX = (x - startX) * 1.5;
        const walkY = (y - startY) * 1.5;
        scrollContainerRef.current.scrollLeft = scrollLeft - walkX;
        scrollContainerRef.current.scrollTop = scrollTop - walkY;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            // Se estiver sobre o container do gráfico, o scroll vira zoom
            // Removemos a necessidade do Ctrl já que temos o "Arraste" para mover
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            setScale(prev => {
                const newScale = prev + delta;
                return Math.min(2, Math.max(0.1, newScale));
            });
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    const treeData = useMemo(() => {
        const idMap: Record<string, OrgMember & { children: any[] }> = {};
        const roots: any[] = [];

        members.forEach(m => {
            idMap[m.id] = { ...m, children: [] };
        });

        members.forEach(m => {
            if (m.parent_id && idMap[m.parent_id]) {
                idMap[m.parent_id].children.push(idMap[m.id]);
            } else {
                roots.push(idMap[m.id]);
            }
        });

        return roots;
    }, [members]);

    const handleAddClick = (parentId: string | null = null) => {
        setEditingMember({ name: '', role: '', parent_id: parentId });
        setIsModalOpen(true);
    };

    const handleEditClick = (member: OrgMember) => {
        setEditingMember(member);
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (confirm('Deseja realmente excluir este colaborador do organograma?')) {
            try {
                await deleteMember.mutateAsync(id);
                props.showToast('Colaborador removido.', 'success');
            } catch (err: any) {
                props.showToast('Erro ao remover: ' + err.message, 'error');
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember?.role) return;

        try {
            // Remove 'children' property which is only used for UI tree structure and doesn't exist in DB
            const { children, ...dataToSave } = editingMember as any;

            // If name is empty but quantity is set, we treat it as a group node
            if (!dataToSave.name && !dataToSave.quantity) {
                props.showToast('Preencha o nome ou a quantidade.', 'error');
                return;
            }

            await saveMember.mutateAsync(dataToSave);
            props.showToast('Organograma atualizado.', 'success');
            setIsModalOpen(false);
        } catch (err: any) {
            props.showToast('Erro ao salvar: ' + err.message, 'error');
        }
    };

    const renderNode = (node: any, isVerticalChild = false) => {
        const isLeaf = node.children.length === 0;
        const hasQuantity = node.quantity > 0;
        const areAllChildrenLeafs = node.children.length > 0 && node.children.every((c: any) => c.children.length === 0);

        return (
            <div key={node.id} className={`flex ${isVerticalChild ? 'flex-row items-center' : 'flex-col items-center'}`}>
                {isVerticalChild && (
                    <div className="w-8 h-px bg-white/20 flex-shrink-0"></div>
                )}

                <div className="relative group">
                    <div className={`p-4 rounded-2xl border ${node.user_id ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/10'} backdrop-blur-md shadow-xl min-w-[180px] transition-all hover:scale-105 hover:border-cyan-400 group`}>
                        <div className="flex flex-col items-center gap-1 text-center">
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{node.role}</span>
                            {hasQuantity ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-black text-white">{node.quantity}</span>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Colab.</span>
                                </div>
                            ) : (
                                <span className="text-sm font-black text-white italic">{node.name || 'Pendente'}</span>
                            )}

                            {node.user_id && (
                                <div className="mt-1 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-bold text-cyan-300 uppercase">
                                    Vínculo Ativo
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button
                                onClick={() => handleAddClick(node.id)}
                                className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-transform hover:scale-110"
                            >
                                <PlusIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleEditClick(node)}
                                className="w-7 h-7 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-600 transition-transform hover:scale-110"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                            </button>
                            <button
                                onClick={() => handleDeleteClick(node.id)}
                                className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-transform hover:scale-110"
                            >
                                <DeleteIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {!isVerticalChild && node.children.length > 0 && (
                    <div className="flex flex-col items-center">
                        <div className="w-px h-8 bg-white/20"></div>
                        {areAllChildrenLeafs ? (
                            <div className="flex flex-col items-start border-l border-white/20 ml-[-0.5px] py-2">
                                {node.children.map((child: any) => renderNode(child, true))}
                            </div>
                        ) : (
                            <div className="flex gap-8 relative items-start">
                                {node.children.length > 1 && (
                                    <div className="absolute top-0 left-[50%] -translate-x-1/2 w-[calc(100%-80px)] h-px bg-white/20"></div>
                                )}
                                {node.children.map((child: any) => (
                                    <div key={child.id} className="flex flex-col items-center">
                                        <div className="w-px h-4 bg-white/20"></div>
                                        {renderNode(child)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!user) return null;

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="orgChart"
                onNavigateToHome={props.onNavigateToHome}
                onNavigateToDashboard={props.onNavigateToDashboard}
                onNavigateToReports={props.onNavigateToReports}
                onNavigateToBaseline={props.onNavigateToBaseline}
                onNavigateToCurrentSchedule={props.onNavigateToCurrentSchedule}
                onNavigateToAnalysis={props.onNavigateToAnalysis}
                onNavigateToLean={props.onNavigateToLean}
                onNavigateToLeanConstruction={props.onNavigateToLeanConstruction}
                onNavigateToWarRoom={props.onNavigateToWarRoom}
                onNavigateToPodcast={props.onNavigateToPodcast}
                onNavigateToCheckoutSummary={props.onNavigateToCheckoutSummary}
                onNavigateToOrgChart={() => { }}
                onNavigateToVisualControl={props.onNavigateToVisualControl}
                onUpgradeClick={props.onUpgradeClick}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50">
                <Header
                    user={user}
                    onLogout={handleLogout}
                    activeScreen="orgChart"
                    {...props}
                />

                <div
                    ref={scrollContainerRef}
                    className={`flex-1 overflow-auto p-8 custom-scrollbar ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div className="w-full min-w-max">
                        <div className="flex justify-between items-center mb-12 max-w-screen-2xl mx-auto">
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tighter">Organograma Hierárquico</h1>
                                <p className="text-brand-med-gray font-bold">Estrutura organizacional da obra e equipe.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
                                    <button
                                        onClick={() => setScale(prev => Math.max(0.2, prev - 0.1))}
                                        className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                        title="Diminuir Zoom"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    </button>
                                    <div className="px-2 min-w-[60px] text-center text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                                        {Math.round(scale * 100)}%
                                    </div>
                                    <button
                                        onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
                                        className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                        title="Aumentar Zoom"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    </button>
                                    <div className="w-px h-6 bg-white/10 mx-1"></div>
                                    <button
                                        onClick={() => setScale(1)}
                                        className="px-3 h-10 flex items-center justify-center text-[10px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase tracking-widest"
                                    >
                                        Reset
                                    </button>
                                </div>
                                {members.length === 0 && (
                                    <button
                                        onClick={() => handleAddClick()}
                                        className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-cyan-500/20 transition-all flex items-center gap-2"
                                    >
                                        <PlusIcon className="w-5 h-5" /> Iniciar Organograma
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-start items-start p-20 min-w-max">
                            <div
                                className="transition-transform duration-300 ease-out origin-top flex flex-col items-center mx-auto"
                                style={{
                                    transform: `scale(${scale})`,
                                    minWidth: 'max-content'
                                }}
                            >
                                {treeData.length > 0 ? (
                                    <div className="flex gap-16 px-40">
                                        {treeData.map(root => renderNode(root))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20">
                                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                                            <ManagementIcon className="w-10 h-10 text-gray-500" />
                                        </div>
                                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Nenhuma estrutura definida</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal de Cadastro */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
                        <div className="relative bg-[#0d1525] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                                    {editingMember?.id ? 'Editar Colaborador' : 'Adicionar Colaborador'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                    <XIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-6">
                                {/* Link with Cadastro */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vincular ao Cadastro (Opcional)</label>
                                    <select
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
                                        value={editingMember?.user_id || ''}
                                        onChange={(e) => {
                                            const userId = e.target.value;
                                            if (userId) {
                                                const selectedUser = allUsers.find(u => u.id === userId);
                                                if (selectedUser) {
                                                    setEditingMember(prev => ({
                                                        ...prev,
                                                        user_id: userId,
                                                        name: selectedUser.fullName,
                                                        role: selectedUser.role
                                                    }));
                                                }
                                            } else {
                                                setEditingMember(prev => ({ ...prev, user_id: null }));
                                            }
                                        }}
                                    >
                                        <option value="" className="bg-[#0b121f]">Preencher Manualmente</option>
                                        {allUsers.map(u => (
                                            <option key={u.id} value={u.id} className="bg-[#0b121f]">{u.fullName} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="h-px bg-white/5 my-4"></div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Hugo Sales"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-bold"
                                        value={editingMember?.name || ''}
                                        onChange={(e) => setEditingMember(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cargo / Função</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Diretor de Operações"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-bold"
                                        value={editingMember?.role || ''}
                                        onChange={(e) => setEditingMember(prev => ({ ...prev, role: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quantidade (Opcional - p/ Equipes)</label>
                                    <input
                                        type="number"
                                        placeholder="Ex: 5"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-bold"
                                        value={editingMember?.quantity || ''}
                                        onChange={(e) => setEditingMember(prev => ({ ...prev, quantity: parseInt(e.target.value) || undefined }))}
                                    />
                                    <p className="text-[9px] text-gray-500 ml-1 italic">Dica: Use para níveis operacionais (Ex: Pedreiros: 10).</p>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-cyan-500/20 transition-all transform hover:scale-[1.02]"
                                >
                                    Salvar Colaborador
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default OrgChartPage;
