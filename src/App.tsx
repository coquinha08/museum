import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut, 
  handleFirestoreError, 
  OperationType 
} from './lib/firebase';
import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  User as FirebaseUser 
} from 'firebase/auth';
import { Manuscript, Scene } from './types';
import { AuthModal } from './components/AuthModal';
import { ManuscriptContextModal } from './components/ManuscriptContextModal';
import { SharedLibraryModal } from './components/SharedLibraryModal';
import { exportManuscriptToPdf, exportSingleSceneToPdf } from './lib/pdfExport';
import { 
  BookOpen, 
  Sparkles, 
  Plus, 
  Trash2, 
  FileText, 
  Download, 
  Globe, 
  LogOut, 
  LogIn, 
  ChevronRight, 
  Sliders, 
  Play, 
  FastForward, 
  Save, 
  Eye, 
  Edit3, 
  Menu, 
  X,
  AlertCircle
} from 'lucide-react';

export default function App() {
  // Authentication State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Manuscripts & Scenes State
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [activeManuscript, setActiveManuscript] = useState<Manuscript | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);

  // Modals & Panels
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isSharedLibraryOpen, setIsSharedLibraryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'reader'>('editor');

  // Agent Generation State
  const [promptOutline, setPromptOutline] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to User Manuscripts in Firestore
  useEffect(() => {
    if (!user) {
      setManuscripts([]);
      setActiveManuscript(null);
      return;
    }

    const q = query(
      collection(db, 'manuscripts'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Manuscript[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Manuscript);
        });
        list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        setManuscripts(list);

        // Auto-select first manuscript or keep current
        if (list.length > 0) {
          setActiveManuscript((prev) => {
            if (prev) {
              const stillExists = list.find((m) => m.id === prev.id);
              if (stillExists) return stillExists;
            }
            return list[0];
          });
        } else {
          setActiveManuscript(null);
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'manuscripts');
        } catch (e) {
          console.warn('Registro de erro ao listar manuscritos:', e);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 3. Listen to Scenes of Active Manuscript
  useEffect(() => {
    if (!activeManuscript) {
      setScenes([]);
      setActiveScene(null);
      return;
    }

    const scenesRef = collection(db, 'manuscripts', activeManuscript.id, 'scenes');
    const q = query(scenesRef, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(
      scenesRef,
      (snapshot) => {
        const list: Scene[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Scene);
        });
        list.sort((a, b) => a.order - b.order);
        setScenes(list);

        setActiveScene((prev) => {
          if (prev) {
            const found = list.find((s) => s.id === prev.id);
            if (found) return found;
          }
          return list[0] || null;
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `manuscripts/${activeManuscript.id}/scenes`);
        } catch (e) {
          console.warn('Registro de erro ao listar cenas:', e);
        }
      }
    );

    return () => unsubscribe();
  }, [activeManuscript?.id]);

  // Sync prompt outline with active scene
  useEffect(() => {
    if (activeScene) {
      setPromptOutline(activeScene.promptOutline || '');
    } else {
      setPromptOutline('');
    }
  }, [activeScene?.id]);

  // Create First or New Manuscript
  const handleCreateManuscript = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const id = crypto.randomUUID();
    const newManuscript: Manuscript = {
      id,
      ownerId: user.uid,
      ownerEmail: user.email || '',
      ownerName: user.displayName || user.email?.split('@')[0] || 'Escritor',
      title: `Novo Romance ${manuscripts.length + 1}`,
      genre: 'Ficção Adulta',
      synopsis: 'Uma trama de alta tensão emocional e desejos proibidos...',
      tone: 'Cinematográfico, sensorial e visceral, com prosa elegante e detalhada.',
      characters: 'Protagonista carismático e complexo.',
      worldRules: 'Sem limites narrativos para a criatividade.',
      visibility: 'private',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'manuscripts', id), newManuscript);

      // Create initial first chapter scene
      const sceneId = crypto.randomUUID();
      const firstScene: Scene = {
        id: sceneId,
        manuscriptId: id,
        ownerId: user.uid,
        order: 1,
        chapterTitle: 'Capítulo 1',
        sceneTitle: 'O Início',
        promptOutline: 'Apresente os protagonistas em um momento de alta tensão e atração mútua.',
        content: '',
        wordCount: 0,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'manuscripts', id, 'scenes', sceneId), firstScene);

      setActiveManuscript(newManuscript);
      setActiveScene(firstScene);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'manuscripts');
    }
  };

  // Create New Scene in Active Manuscript
  const handleCreateScene = async () => {
    if (!activeManuscript || !user) return;

    const nextOrder = scenes.length > 0 ? Math.max(...scenes.map((s) => s.order)) + 1 : 1;
    const sceneId = crypto.randomUUID();
    const newScene: Scene = {
      id: sceneId,
      manuscriptId: activeManuscript.id,
      ownerId: user.uid,
      order: nextOrder,
      chapterTitle: `Capítulo ${nextOrder}`,
      sceneTitle: `Cena ${nextOrder}`,
      promptOutline: '',
      content: '',
      wordCount: 0,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'manuscripts', activeManuscript.id, 'scenes', sceneId), newScene);
      setActiveScene(newScene);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `manuscripts/${activeManuscript.id}/scenes`);
    }
  };

  // Delete Scene
  const handleDeleteScene = async (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeManuscript || !confirm('Deseja excluir esta cena? Esta ação é irreversível.')) return;

    try {
      await deleteDoc(doc(db, 'manuscripts', activeManuscript.id, 'scenes', sceneId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `manuscripts/${activeManuscript.id}/scenes/${sceneId}`);
    }
  };

  // Delete Manuscript
  const handleDeleteManuscript = async (manuscriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir toda a obra e seus capítulos?')) return;

    try {
      await deleteDoc(doc(db, 'manuscripts', manuscriptId));
      if (activeManuscript?.id === manuscriptId) {
        setActiveManuscript(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `manuscripts/${manuscriptId}`);
    }
  };

  // Save Scene Content to Firestore
  const saveSceneToDatabase = async (contentToSave: string, outlineToSave?: string) => {
    if (!activeManuscript || !activeScene || !user) return;
    setSaveStatus('saving');

    const words = contentToSave.trim() ? contentToSave.trim().split(/\s+/).length : 0;
    const updatedFields: Partial<Scene> = {
      content: contentToSave,
      wordCount: words,
      updatedAt: new Date().toISOString(),
    };

    if (outlineToSave !== undefined) {
      updatedFields.promptOutline = outlineToSave;
    }

    try {
      await setDoc(
        doc(db, 'manuscripts', activeManuscript.id, 'scenes', activeScene.id),
        updatedFields,
        { merge: true }
      );
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('unsaved');
      console.error('Erro ao salvar cena:', err);
    }
  };

  // Handle Text Content Change in Editor
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (activeScene) {
      setActiveScene({ ...activeScene, content: newContent });
    }
    setSaveStatus('unsaved');
  };

  // Auto-save on blur or after typing pause
  const handleContentBlur = () => {
    if (activeScene) {
      saveSceneToDatabase(activeScene.content, promptOutline);
    }
  };

  // AI Agent: Generate or Continue Scene with Gemini 3 Pro
  const handleAgentGenerate = async (mode: 'generate' | 'continue') => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!activeManuscript || !activeScene) return;

    setIsGenerating(true);
    setGenerationError(null);

    const previousText = activeScene.content || '';
    let accumulatedText = mode === 'continue' ? (previousText ? previousText + '\n\n' : '') : '';

    try {
      const response = await fetch('/api/generate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manuscriptContext: activeManuscript,
          chapterTitle: activeScene.chapterTitle,
          sceneTitle: activeScene.sceneTitle,
          promptOutline: promptOutline,
          previousContent: previousText,
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Falha no servidor: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Não foi possível iniciar o leitor de stream.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '').trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.error) {
                throw new Error(data.error);
              }

              // Extract chunk text from Gemini 3 Pro candidate
              const chunkText = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunkText) {
                accumulatedText += chunkText;
                setActiveScene((prev) => prev ? { ...prev, content: accumulatedText } : null);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('Unexpected')) {
                throw e;
              }
            }
          }
        }
      }

      // Save complete text once stream finishes
      await saveSceneToDatabase(accumulatedText, promptOutline);
    } catch (err: any) {
      console.error('Erro no agente:', err);
      setGenerationError(err.message || 'Erro ao comunicar com o modelo Gemini 3 Pro.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Export Full Book to PDF
  const handleExportFullBook = () => {
    if (!activeManuscript || scenes.length === 0) return;
    exportManuscriptToPdf(activeManuscript, scenes);
  };

  // Export Current Scene to PDF
  const handleExportCurrentScene = () => {
    if (!activeManuscript || !activeScene) return;
    exportSingleSceneToPdf(activeManuscript.title, activeScene);
  };

  // Save Bible/Context Updates
  const handleSaveContext = async (updated: Partial<Manuscript>) => {
    if (!activeManuscript) return;
    try {
      await setDoc(doc(db, 'manuscripts', activeManuscript.id), updated, { merge: true });
      setActiveManuscript((prev) => prev ? { ...prev, ...updated } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `manuscripts/${activeManuscript.id}`);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-100 font-sans">
      {/* --- TOP BAR (Mandatory Contract) --- */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-stone-900 border-b border-stone-800 z-30 flex items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1.5 text-stone-400 hover:text-stone-200"
            aria-label="Menu de Navegação"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-lg font-serif font-semibold tracking-tight text-stone-100 whitespace-nowrap">
              Museum 2.0
            </span>
            <span className="hidden sm:inline-block text-[11px] font-mono uppercase tracking-widest text-amber-500/90 pl-1 border-l border-stone-800">
              Gemini 3 Pro
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links & Studio Controls */}
        <nav className="flex items-center gap-2 sm:gap-4 text-xs font-medium text-stone-400">
          <button
            onClick={() => setIsSharedLibraryOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition-colors whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Biblioteca Compartilhada</span>
          </button>

          {activeManuscript && (
            <button
              onClick={() => setIsContextModalOpen(true)}
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition-colors whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-500" />
              <span>Bíblia da Obra</span>
            </button>
          )}

          {activeScene && (
            <div className="flex items-center border-l border-stone-800 pl-2 sm:pl-4 gap-1.5">
              <button
                onClick={handleExportCurrentScene}
                title="Baixar Cena Atual em PDF"
                className="flex items-center gap-1 py-1.5 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">PDF Cena</span>
              </button>

              <button
                onClick={handleExportFullBook}
                title="Baixar Livro Completo em PDF"
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium text-xs transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF Livro</span>
              </button>
            </div>
          )}
        </nav>

        {/* Zone 3: Primary Action / User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {authLoading ? (
            <div className="w-6 h-6 rounded-full bg-stone-800 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <div 
                className="w-7 h-7 rounded-full bg-amber-600/20 border border-amber-600/40 text-amber-400 flex items-center justify-center text-xs font-semibold"
                title={user.email || 'Autor'}
              >
                {user.displayName ? user.displayName[0].toUpperCase() : user.email ? user.email[0].toUpperCase() : 'A'}
              </div>
              <button
                onClick={() => signOut(auth)}
                className="text-stone-400 hover:text-red-400 p-1 transition-colors"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-stone-950 bg-stone-100 hover:bg-white rounded-lg transition-all active:scale-[0.98]"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar / Cadastrar</span>
            </button>
          )}
        </div>
      </header>

      {/* --- MAIN STUDIO WORKSPACE --- */}
      <div className="flex-1 flex pt-14 h-full overflow-hidden">
        {/* --- LEFT SIDEBAR: MANUSCRIPTS & CHAPTERS --- */}
        <aside
          className={`fixed md:relative top-14 bottom-0 left-0 w-72 bg-stone-900/95 md:bg-stone-900 border-r border-stone-800 z-20 flex flex-col transition-transform duration-200 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Manuscripts Switcher */}
          <div className="p-3.5 border-b border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-stone-500 font-mono">
                Seus Manuscritos
              </span>
              <button
                onClick={handleCreateManuscript}
                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
                title="Criar Novo Romance"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo</span>
              </button>
            </div>

            {manuscripts.length > 0 ? (
              <select
                value={activeManuscript?.id || ''}
                onChange={(e) => {
                  const selected = manuscripts.find((m) => m.id === e.target.value);
                  if (selected) setActiveManuscript(selected);
                }}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-hidden focus:border-amber-600 transition-colors"
              >
                {manuscripts.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            ) : (
              <button
                onClick={handleCreateManuscript}
                className="w-full py-2 px-3 border border-dashed border-stone-700 hover:border-amber-600 rounded-lg text-xs text-stone-400 hover:text-stone-200 text-center transition-colors"
              >
                + Começar primeiro manuscrito
              </button>
            )}
          </div>

          {/* Active Manuscript Meta Summary */}
          {activeManuscript && (
            <div className="px-3.5 py-2.5 bg-stone-950/40 border-b border-stone-850 flex items-center justify-between text-xs">
              <div className="overflow-hidden">
                <div className="font-serif text-stone-200 truncate">{activeManuscript.title}</div>
                <div className="text-[10px] text-stone-500 uppercase tracking-wider">{activeManuscript.genre || 'Ficção'}</div>
              </div>
              <button
                onClick={(e) => handleDeleteManuscript(activeManuscript.id, e)}
                title="Excluir este romance"
                className="text-stone-600 hover:text-red-400 p-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Scenes / Chapters List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="flex items-center justify-between px-1 py-1 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-stone-500 font-mono">
                Cenas & Capítulos
              </span>
              <button
                onClick={handleCreateScene}
                disabled={!activeManuscript}
                className="text-xs text-stone-400 hover:text-amber-500 transition-colors disabled:opacity-30"
                title="Adicionar Nova Cena"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {scenes.length === 0 ? (
              <div className="text-center py-8 text-stone-600 text-xs px-2">
                Nenhuma cena criada ainda. Clique em + para começar a escrever.
              </div>
            ) : (
              scenes.map((scene, idx) => (
                <div
                  key={scene.id}
                  onClick={() => {
                    setActiveScene(scene);
                    setSidebarOpen(false);
                  }}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                    activeScene?.id === scene.id
                      ? 'bg-stone-800 text-stone-100 border border-stone-700/80 shadow-xs'
                      : 'text-stone-400 hover:bg-stone-850 hover:text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <div className="truncate">
                      <div className="font-medium truncate">{scene.chapterTitle || `Capítulo ${idx + 1}`}</div>
                      {scene.sceneTitle && (
                        <div className="text-[10px] text-stone-500 truncate">{scene.sceneTitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-stone-500">
                      {scene.wordCount || 0}w
                    </span>
                    <button
                      onClick={(e) => handleDeleteScene(scene.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-stone-600 hover:text-red-400 p-0.5 transition-opacity"
                      title="Excluir cena"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick stats bottom strip */}
          {activeManuscript && (
            <div className="p-3 border-t border-stone-800 bg-stone-950/70 text-[11px] text-stone-500 flex items-center justify-between font-mono">
              <span>{scenes.length} cenas</span>
              <span>
                {scenes.reduce((acc, s) => acc + (s.wordCount || 0), 0).toLocaleString()} palavras no total
              </span>
            </div>
          )}
        </aside>

        {/* --- CENTRAL AGENT & WRITING CANVAS --- */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#121211]">
          {activeScene ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Scene Subheader Ribbon */}
              <div className="h-11 border-b border-stone-800/80 bg-stone-900/60 px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={activeScene.chapterTitle}
                    onChange={(e) => {
                      const updated = { ...activeScene, chapterTitle: e.target.value };
                      setActiveScene(updated);
                      saveSceneToDatabase(activeScene.content);
                    }}
                    className="font-medium text-stone-200 bg-transparent border-b border-transparent hover:border-stone-700 focus:border-amber-600 focus:outline-hidden px-1 py-0.5 transition-colors"
                  />
                  <span className="text-stone-600">/</span>
                  <input
                    type="text"
                    value={activeScene.sceneTitle}
                    placeholder="Título da cena..."
                    onChange={(e) => {
                      const updated = { ...activeScene, sceneTitle: e.target.value };
                      setActiveScene(updated);
                    }}
                    onBlur={() => saveSceneToDatabase(activeScene.content)}
                    className="text-stone-400 bg-transparent border-b border-transparent hover:border-stone-700 focus:border-amber-600 focus:outline-hidden px-1 py-0.5 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs text-stone-500 font-mono">
                  <span>{activeScene.content ? activeScene.content.trim().split(/\s+/).length : 0} palavras</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Save className={`w-3 h-3 ${saveStatus === 'saving' ? 'text-amber-500 animate-spin' : saveStatus === 'saved' ? 'text-emerald-500' : 'text-stone-500'}`} />
                    {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Não salvo'}
                  </span>
                  <span>·</span>
                  <div className="flex items-center gap-1 bg-stone-850 p-0.5 rounded-md">
                    <button
                      onClick={() => setViewMode('editor')}
                      className={`p-1 rounded ${viewMode === 'editor' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
                      title="Modo Editor"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('reader')}
                      className={`p-1 rounded ${viewMode === 'reader' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
                      title="Modo Leitura Editorial"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Agent Director Prompt Box (Top Workspace) */}
              <div className="p-4 sm:px-6 bg-stone-900/40 border-b border-stone-800/80 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-600/10 border border-amber-600/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] uppercase tracking-wider font-mono text-stone-400">
                        Diretriz da Cena para o Gemini 3 Pro
                      </label>
                      <span className="text-[11px] text-amber-500/90 font-mono">
                        {activeManuscript?.tone ? `Tom: ${activeManuscript.tone.slice(0, 45)}...` : 'Ficção Adulta Irrestrita'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <textarea
                        rows={2}
                        value={promptOutline}
                        onChange={(e) => setPromptOutline(e.target.value)}
                        placeholder="Descreva o que acontece nesta cena (diálogos, atrito corporal, revelações, ritmo, ações explícitas)..."
                        className="flex-1 px-3 py-2 bg-stone-950/80 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder:text-stone-600 focus:outline-hidden focus:border-amber-600 resize-none transition-colors"
                      />

                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleAgentGenerate('generate')}
                          disabled={isGenerating}
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-xl font-medium text-xs transition-all shadow-md active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isGenerating ? 'Escrevendo...' : 'Escrever Cena'}</span>
                        </button>

                        <button
                          onClick={() => handleAgentGenerate('continue')}
                          disabled={isGenerating || !activeScene.content}
                          title="Sem limites de tamanho: continue a história de onde parou"
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200 rounded-xl font-medium text-xs transition-colors disabled:opacity-40 whitespace-nowrap"
                        >
                          <FastForward className="w-3.5 h-3.5 text-amber-400" />
                          <span>Continuar</span>
                        </button>
                      </div>
                    </div>

                    {generationError && (
                      <div className="mt-2.5 flex items-center gap-2 p-2 rounded-lg bg-red-950/70 border border-red-800/80 text-red-200 text-xs">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{generationError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Prose Content Area */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-8 flex justify-center">
                <div className="w-full max-w-3xl">
                  {viewMode === 'editor' ? (
                    <div className="relative">
                      <textarea
                        ref={editorRef}
                        value={activeScene.content || ''}
                        onChange={handleContentChange}
                        onBlur={handleContentBlur}
                        placeholder="O texto gerado pelo Gemini 3 Pro aparecerá aqui em tempo real. Você também pode editar e digitar livremente..."
                        className="w-full min-h-[60vh] bg-transparent text-stone-200 font-serif text-[15px] sm:text-[16px] leading-[1.8] focus:outline-hidden resize-none placeholder:text-stone-700 placeholder:font-sans selection:bg-amber-600/30"
                      />
                      {isGenerating && (
                        <div className="flex items-center gap-2 text-xs text-amber-500/90 font-mono mt-4 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                          <span>Gemini 3 Pro compondo em prosa contínua...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Elegant Book Reading Mode */
                    <article className="prose prose-invert max-w-none text-stone-200 font-serif leading-[1.85] text-justify selection:bg-amber-600/30">
                      <header className="mb-8 pb-4 border-b border-stone-800/80 text-center">
                        <span className="text-xs uppercase tracking-widest text-amber-500/80 font-mono">
                          {activeManuscript.title}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-serif text-stone-100 mt-1">
                          {activeScene.chapterTitle}
                        </h2>
                        {activeScene.sceneTitle && (
                          <p className="text-sm italic text-stone-400 mt-1">
                            {activeScene.sceneTitle}
                          </p>
                        )}
                      </header>

                      {activeScene.content ? (
                        <div className="whitespace-pre-line text-[15px] sm:text-[16px]">
                          {activeScene.content}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-stone-600 italic">
                          Esta cena ainda não possui texto. Use o painel acima para desenvolvê-la com o Gemini 3 Pro.
                        </div>
                      )}
                    </article>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Zero State: No Scene Selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-500">
              <BookOpen className="w-14 h-14 stroke-1 mb-4 text-stone-700" />
              <h3 className="text-xl font-serif text-stone-300">Nenhum Manuscrito Selecionado</h3>
              <p className="text-xs text-stone-500 max-w-md mt-1 mb-6">
                Crie um novo romance para configurar a bíblia de personagens, tom e desenvolver cenas completas com o Gemini 3 Pro.
              </p>
              <button
                onClick={handleCreateManuscript}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium text-xs transition-all shadow-md active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Começar Novo Romance</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* --- MODALS --- */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {activeManuscript && (
        <ManuscriptContextModal
          isOpen={isContextModalOpen}
          onClose={() => setIsContextModalOpen(false)}
          manuscript={activeManuscript}
          onSave={handleSaveContext}
        />
      )}

      <SharedLibraryModal
        isOpen={isSharedLibraryOpen}
        onClose={() => setIsSharedLibraryOpen(false)}
        onSelectManuscript={(m) => {
          setIsSharedLibraryOpen(false);
          setActiveManuscript(m);
        }}
      />
    </div>
  );
}
