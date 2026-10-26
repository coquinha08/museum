import React, { useEffect, useState } from 'react';
import { Manuscript, Scene } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { X, Globe, BookOpen, Download, User, Calendar } from 'lucide-react';
import { exportManuscriptToPdf } from '../lib/pdfExport';

interface SharedLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManuscript?: (manuscript: Manuscript) => void;
}

export const SharedLibraryModal: React.FC<SharedLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectManuscript,
}) => {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWork, setSelectedWork] = useState<Manuscript | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loadingScenes, setLoadingScenes] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSharedWorks();
    }
  }, [isOpen]);

  const loadSharedWorks = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'manuscripts'),
        where('visibility', '==', 'shared')
      );
      const snapshot = await getDocs(q);
      const docs: Manuscript[] = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() } as Manuscript);
      });
      // Sort by updatedAt descending
      docs.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      setManuscripts(docs);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.LIST, 'manuscripts');
      } catch (e) {
        console.warn('Registro de erro da biblioteca:', e);
      }
      setManuscripts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkDetails = async (manuscript: Manuscript) => {
    setSelectedWork(manuscript);
    setLoadingScenes(true);
    try {
      const scenesRef = collection(db, 'manuscripts', manuscript.id, 'scenes');
      const q = query(scenesRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const sceneList: Scene[] = [];
      snapshot.forEach((doc) => {
        sceneList.push({ id: doc.id, ...doc.data() } as Scene);
      });
      setScenes(sceneList);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.LIST, `manuscripts/${manuscript.id}/scenes`);
      } catch (e) {
        console.warn('Registro de erro ao carregar cenas:', e);
      }
      setScenes([]);
    } finally {
      setLoadingScenes(false);
    }
  };

  const handleExportPdf = () => {
    if (!selectedWork) return;
    exportManuscriptToPdf(selectedWork, scenes);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-4xl h-[85vh] bg-stone-900 border border-stone-800 rounded-2xl flex flex-col text-stone-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 border border-emerald-600/30 flex items-center justify-center text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif text-stone-100">Biblioteca Compartilhada</h2>
              <p className="text-xs text-stone-400">Obras e universos tornados públicos pelos autores</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* List of Shared Works */}
          <div className="md:col-span-5 border-r border-stone-800 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center py-12 text-stone-500 text-xs">Carregando manuscritos...</div>
            ) : manuscripts.length === 0 ? (
              <div className="text-center py-12 px-4 text-stone-500 text-xs">
                Nenhum manuscrito compartilhado publicamente no momento. Marque um de seus manuscritos como &quot;Compartilhado&quot; no contexto para que ele apareça aqui!
              </div>
            ) : (
              manuscripts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadWorkDetails(item)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                    selectedWork?.id === item.id
                      ? 'bg-stone-800 border-amber-600/60 text-stone-100 shadow-sm'
                      : 'bg-stone-950/60 border-stone-850 hover:bg-stone-800/50 text-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-serif font-medium text-stone-200 line-clamp-1">
                      {item.title}
                    </h3>
                    <span className="text-[10px] uppercase font-mono text-amber-500/90 shrink-0">
                      {item.genre || 'Ficção'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 line-clamp-2 mt-1">
                    {item.synopsis || 'Sem sinopse cadastrada.'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-stone-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {item.ownerName || item.ownerEmail?.split('@')[0] || 'Autor'}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.updatedAt || item.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Details / Preview of Selected Work */}
          <div className="md:col-span-7 flex flex-col h-full overflow-hidden bg-stone-950/40">
            {selectedWork ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Work Header */}
                <div className="p-6 border-b border-stone-800/80 shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-amber-500">
                        {selectedWork.genre || 'Ficção Adulta'}
                      </span>
                      <h3 className="text-2xl font-serif text-stone-100 mt-0.5">
                        {selectedWork.title}
                      </h3>
                      <p className="text-xs text-stone-400 mt-1">
                        Por {selectedWork.ownerName || selectedWork.ownerEmail || 'Autor'}
                      </p>
                    </div>

                    <button
                      onClick={handleExportPdf}
                      disabled={loadingScenes || scenes.length === 0}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-medium transition-colors disabled:opacity-40 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-500" />
                      <span>Baixar Livro (PDF)</span>
                    </button>
                  </div>

                  {selectedWork.synopsis && (
                    <div className="mt-4 p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs text-stone-300 italic">
                      &quot;{selectedWork.synopsis}&quot;
                    </div>
                  )}
                </div>

                {/* Chapters & Scenes Viewer */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {loadingScenes ? (
                    <div className="text-center py-12 text-stone-500 text-xs">Carregando cenas...</div>
                  ) : scenes.length === 0 ? (
                    <div className="text-center py-12 text-stone-500 text-xs">
                      Este manuscrito ainda não possui cenas escritas.
                    </div>
                  ) : (
                    scenes.map((scene, idx) => (
                      <article key={scene.id} className="border-b border-stone-800/60 pb-6 last:border-0">
                        <div className="flex items-baseline justify-between mb-2">
                          <h4 className="text-base font-serif font-medium text-stone-200">
                            {scene.chapterTitle || `Capítulo ${idx + 1}`}
                            {scene.sceneTitle && ` — ${scene.sceneTitle}`}
                          </h4>
                          <span className="text-[11px] text-stone-500 font-mono">
                            {scene.wordCount || 0} palavras
                          </span>
                        </div>
                        <div className="text-xs text-stone-300 leading-relaxed font-serif whitespace-pre-line text-justify">
                          {scene.content}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-500">
                <BookOpen className="w-12 h-12 stroke-1 mb-3 text-stone-600" />
                <p className="text-sm">Selecione uma obra à esquerda para visualizar sua prévia e baixar em PDF</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
