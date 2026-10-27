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
  deleteDoc 
} from 'firebase/firestore';
import { 
  User as FirebaseUser 
} from 'firebase/auth';
import { Manuscript, Scene } from './types';
import { AuthModal } from './components/AuthModal';
import { ManuscriptContextModal } from './components/ManuscriptContextModal';
import { SharedLibraryModal } from './components/SharedLibraryModal';
import { 
  createScenePdfBlobUrl, 
  createManuscriptPdfBlobUrl, 
  exportSingleSceneToPdf, 
  exportManuscriptToPdf 
} from './lib/pdfExport';
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
  Sliders, 
  FastForward, 
  Menu, 
  X,
  AlertCircle,
  ExternalLink,
  BookMarked,
  Printer,
  Edit2
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

  // PDF Viewer State
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [pdfScope, setPdfScope] = useState<'scene' | 'full'>('scene');
  const [showRawText, setShowRawText] = useState(false);

  // Agent Generation State
  const [promptOutline, setPromptOutline] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('Compondo cena...');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<'gemini-2.5-flash' | 'gemini-3.1-pro-preview'>('gemini-2.5-flash');

  // Starter Guest Manuscript and Scene
  const STARTER_MANUSCRIPT: Manuscript = {
    id: 'guest-manuscript-1',
    ownerId: 'guest-author',
    ownerEmail: 'autor@local',
    ownerName: 'Escritor Convidado',
    title: 'O Sussurro do Museu',
    genre: 'Ficção Literária Adulta / Suspense Psicológico',
    synopsis: 'Nas galerias e arquivos silenciosos de um prestigiado museu, segredos proibidos, mistérios e encontros de alta intensidade vêm à tona.',
    tone: 'Sensorial, cinematográfico, visceral e sem censura moral.',
    characters: 'Protagonista carismático, observador atento e parceira envolvente.',
    worldRules: 'Sem limites criativos ou tabus narrativos.',
    visibility: 'private',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const STARTER_SCENE: Scene = {
    id: 'guest-scene-1',
    manuscriptId: 'guest-manuscript-1',
    ownerId: 'guest-author',
    order: 1,
    chapterTitle: 'Capítulo 1',
    sceneTitle: 'A Revelação na Ala Leste',
    promptOutline: 'Apresente os protagonistas em um encontro noturno no museu, diálogos tensos, atração palpável e riqueza sensorial.',
    content: '',
    wordCount: 0,
    updatedAt: new Date().toISOString(),
  };

  const cleanErrorMessage = (raw: any): string => {
    let msg = raw?.message || String(raw || 'Erro desconhecido');
    if (typeof msg === 'string') {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error?.message) msg = parsed.error.message;
        else if (parsed.error && typeof parsed.error === 'string') msg = parsed.error;
      } catch {}
    }
    if (typeof msg === 'string') {
      try {
        const inner = JSON.parse(msg);
        if (inner.error?.message) msg = inner.error.message;
      } catch {}
    }
    if (
      msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('quota') ||
      msg.includes('rate-limit')
    ) {
      return 'A cota diária do modelo Pro foi atingida no plano gratuito da Google AI Studio. O sistema alternou automaticamente para o Gemini 2.5 Flash (com cota alta e ilimitada). Clique em "Gerar PDF" novamente para prosseguir!';
    }
    return msg;
  };

  const loadGuestData = () => {
    try {
      const storedM = localStorage.getItem('museum_guest_manuscripts');
      const storedS = localStorage.getItem('museum_guest_scenes');
      const mList: Manuscript[] = storedM ? JSON.parse(storedM) : [STARTER_MANUSCRIPT];
      const sList: Scene[] = storedS ? JSON.parse(storedS) : [STARTER_SCENE];
      return { mList, sList };
    } catch {
      return { mList: [STARTER_MANUSCRIPT], sList: [STARTER_SCENE] };
    }
  };

  const saveGuestManuscript = (m: Manuscript) => {
    setManuscripts(prev => {
      const exists = prev.find(item => item.id === m.id);
      const next = exists ? prev.map(item => item.id === m.id ? m : item) : [m, ...prev];
      localStorage.setItem('museum_guest_manuscripts', JSON.stringify(next));
      return next;
    });
  };

  const saveGuestScene = (s: Scene) => {
    setScenes(prev => {
      const exists = prev.find(item => item.id === s.id);
      const next = exists ? prev.map(item => item.id === s.id ? s : item) : [...prev, s];
      localStorage.setItem('museum_guest_scenes', JSON.stringify(next));
      return next;
    });
  };

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to User Manuscripts in Firestore or LocalStorage
  useEffect(() => {
    if (!user) {
      const { mList, sList } = loadGuestData();
      setManuscripts(mList);
      setActiveManuscript(mList[0] || null);
      setScenes(sList);
      setActiveScene(sList[0] || null);
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
          console.warn('Erro ao listar manuscritos:', e);
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

    if (!user) {
      try {
        const storedS = localStorage.getItem('museum_guest_scenes');
        const sList: Scene[] = storedS ? JSON.parse(storedS) : [STARTER_SCENE];
        const manuscriptScenes = sList.filter((s) => s.manuscriptId === activeManuscript.id);
        const finalScenes = manuscriptScenes.length > 0 ? manuscriptScenes : [
          {
            ...STARTER_SCENE,
            id: `guest-scene-${Date.now()}`,
            manuscriptId: activeManuscript.id,
          }
        ];
        setScenes(finalScenes);
        setActiveScene((prev) => {
          if (prev) {
            const found = finalScenes.find((s) => s.id === prev.id);
            if (found) return found;
          }
          return finalScenes[0];
        });
      } catch {
        setScenes([STARTER_SCENE]);
        setActiveScene(STARTER_SCENE);
      }
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
          console.warn('Erro ao listar cenas:', e);
        }
      }
    );

    return () => unsubscribe();
  }, [activeManuscript?.id, user]);

  // Update prompt outline when active scene changes
  useEffect(() => {
    if (activeScene) {
      setPromptOutline(activeScene.promptOutline || '');
      // If scene has content, build its PDF preview
      if (activeScene.content && activeManuscript && !isGenerating) {
        try {
          const url = createScenePdfBlobUrl(activeManuscript.title, activeScene);
          setCurrentPdfUrl(url);
          setPdfScope('scene');
        } catch (e) {
          console.error('Erro ao compilar PDF da cena:', e);
        }
      } else if (!activeScene.content) {
        setCurrentPdfUrl(null);
      }
    } else {
      setPromptOutline('');
      setCurrentPdfUrl(null);
    }
  }, [activeScene?.id, activeManuscript?.title]);

  // Create First or New Manuscript
  const handleCreateManuscript = async () => {
    const id = crypto.randomUUID();
    const newManuscript: Manuscript = {
      id,
      ownerId: user ? user.uid : 'guest-author',
      ownerEmail: user?.email || 'autor@local',
      ownerName: user?.displayName || user?.email?.split('@')[0] || 'Escritor',
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

    const sceneId = crypto.randomUUID();
    const firstScene: Scene = {
      id: sceneId,
      manuscriptId: id,
      ownerId: user ? user.uid : 'guest-author',
      order: 1,
      chapterTitle: 'Capítulo 1',
      sceneTitle: 'O Início',
      promptOutline: 'Apresente os protagonistas em um momento de alta tensão e atração mútua.',
      content: '',
      wordCount: 0,
      updatedAt: new Date().toISOString(),
    };

    if (user) {
      try {
        await setDoc(doc(db, 'manuscripts', id), newManuscript);
        await setDoc(doc(db, 'manuscripts', id, 'scenes', sceneId), firstScene);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'manuscripts');
      }
    } else {
      saveGuestManuscript(newManuscript);
      saveGuestScene(firstScene);
    }

    setActiveManuscript(newManuscript);
    setActiveScene(firstScene);
  };

  // Create New Scene in Active Manuscript
  const handleCreateScene = async () => {
    if (!activeManuscript) return;

    const nextOrder = scenes.length > 0 ? Math.max(...scenes.map((s) => s.order)) + 1 : 1;
    const sceneId = crypto.randomUUID();
    const newScene: Scene = {
      id: sceneId,
      manuscriptId: activeManuscript.id,
      ownerId: user ? user.uid : 'guest-author',
      order: nextOrder,
      chapterTitle: `Capítulo ${nextOrder}`,
      sceneTitle: `Cena ${nextOrder}`,
      promptOutline: '',
      content: '',
      wordCount: 0,
      updatedAt: new Date().toISOString(),
    };

    if (user) {
      try {
        await setDoc(doc(db, 'manuscripts', activeManuscript.id, 'scenes', sceneId), newScene);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `manuscripts/${activeManuscript.id}/scenes`);
      }
    } else {
      saveGuestScene(newScene);
    }

    setActiveScene(newScene);
    setCurrentPdfUrl(null);
  };

  // Delete Scene
  const handleDeleteScene = async (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeManuscript || !confirm('Deseja excluir esta cena? Esta ação é irreversível.')) return;

    if (user) {
      try {
        await deleteDoc(doc(db, 'manuscripts', activeManuscript.id, 'scenes', sceneId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `manuscripts/${activeManuscript.id}/scenes/${sceneId}`);
      }
    } else {
      setScenes((prev) => {
        const next = prev.filter((s) => s.id !== sceneId);
        localStorage.setItem('museum_guest_scenes', JSON.stringify(next));
        return next;
      });
      if (activeScene?.id === sceneId) {
        setActiveScene(scenes.find((s) => s.id !== sceneId) || null);
      }
    }
  };

  // Delete Manuscript
  const handleDeleteManuscript = async (manuscriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir toda a obra e seus capítulos?')) return;

    if (user) {
      try {
        await deleteDoc(doc(db, 'manuscripts', manuscriptId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `manuscripts/${manuscriptId}`);
      }
    } else {
      setManuscripts((prev) => {
        const next = prev.filter((m) => m.id !== manuscriptId);
        localStorage.setItem('museum_guest_manuscripts', JSON.stringify(next));
        return next;
      });
    }

    if (activeManuscript?.id === manuscriptId) {
      setActiveManuscript(null);
      setActiveScene(null);
      setCurrentPdfUrl(null);
    }
  };

  // AI Agent: Generate or Continue Scene Directly into PDF
  const handleGeneratePdf = async (mode: 'generate' | 'continue') => {
    if (!activeManuscript || !activeScene) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStep(
      selectedModel === 'gemini-2.5-flash'
        ? 'Gemini 2.5 Flash compondo narrativa sem limites...'
        : 'Gemini 3 Pro compondo narrativa...'
    );

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
          requestedModel: selectedModel,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(cleanErrorMessage(errText || response.statusText));
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
              if (data.error) throw new Error(cleanErrorMessage(data.error));
              if (data.info) {
                setGenerationStep(data.info);
              }

              const chunkText = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunkText) {
                accumulatedText += chunkText;
                setGenerationStep(`Escrevendo cena (${accumulatedText.split(/\s+/).length} palavras)...`);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('Unexpected')) throw e;
            }
          }
        }
      }

      // Step: Compile PDF
      setGenerationStep('Diagramando tipografia editorial e gerando PDF...');
      const words = accumulatedText.trim() ? accumulatedText.trim().split(/\s+/).length : 0;
      const updatedScene: Scene = {
        ...activeScene,
        content: accumulatedText,
        wordCount: words,
        promptOutline,
        updatedAt: new Date().toISOString(),
      };

      if (user) {
        await setDoc(
          doc(db, 'manuscripts', activeManuscript.id, 'scenes', activeScene.id),
          {
            content: accumulatedText,
            wordCount: words,
            promptOutline,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } else {
        saveGuestScene(updatedScene);
      }

      setActiveScene(updatedScene);

      // Instantly generate and display PDF Blob
      const pdfBlobUrl = createScenePdfBlobUrl(activeManuscript.title, updatedScene);
      setCurrentPdfUrl(pdfBlobUrl);
      setPdfScope('scene');

    } catch (err: any) {
      console.error('Erro na geração do PDF:', err);
      const cleaned = cleanErrorMessage(err?.message || err);
      setGenerationError(cleaned);
      if (cleaned.includes('cota') || cleaned.includes('Flash')) {
        setSelectedModel('gemini-2.5-flash');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Compile and show Full Book PDF
  const handleViewFullBookPdf = () => {
    if (!activeManuscript || scenes.length === 0) return;
    try {
      const fullPdfUrl = createManuscriptPdfBlobUrl(activeManuscript, scenes);
      setCurrentPdfUrl(fullPdfUrl);
      setPdfScope('full');
    } catch (err) {
      console.error('Erro ao compilar livro completo:', err);
    }
  };

  // Save Bible/Context Updates
  const handleSaveContext = async (updated: Partial<Manuscript>) => {
    if (!activeManuscript) return;
    const merged = { ...activeManuscript, ...updated };
    if (user) {
      try {
        await setDoc(doc(db, 'manuscripts', activeManuscript.id), updated, { merge: true });
        setActiveManuscript(merged);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `manuscripts/${activeManuscript.id}`);
      }
    } else {
      saveGuestManuscript(merged);
      setActiveManuscript(merged);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#121211] text-stone-100 font-sans">
      {/* --- TOP BAR --- */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-stone-900 border-b border-stone-800 z-30 flex items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1.5 text-stone-400 hover:text-stone-200"
            aria-label="Menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-lg font-serif font-semibold tracking-tight text-stone-100 whitespace-nowrap">
              Museum 2.0
            </span>
            <span className="hidden sm:inline-block text-[11px] font-mono uppercase tracking-widest text-amber-500/90 pl-2 border-l border-stone-800">
              PDF Studio
            </span>
          </div>
        </div>

        {/* Navigation / Action bar */}
        <nav className="flex items-center gap-2 sm:gap-3 text-xs font-medium text-stone-400">
          <button
            onClick={() => setIsSharedLibraryOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:text-stone-100 hover:bg-stone-800 transition-colors whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Biblioteca Compartilhada</span>
          </button>

          {activeManuscript && (
            <button
              onClick={() => setIsContextModalOpen(true)}
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:text-stone-100 hover:bg-stone-800 transition-colors whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-500" />
              <span>Bíblia da Obra</span>
            </button>
          )}

          {activeManuscript && scenes.length > 0 && (
            <button
              onClick={handleViewFullBookPdf}
              title="Visualizar e baixar livro completo em PDF"
              className={`flex items-center gap-1 py-1.5 px-2.5 rounded-lg border text-xs transition-colors whitespace-nowrap ${
                pdfScope === 'full' && currentPdfUrl
                  ? 'bg-amber-600/20 border-amber-600 text-amber-300'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-750'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5 text-amber-400" />
              <span>Livro Completo (PDF)</span>
            </button>
          )}
        </nav>

        {/* Auth / Profile */}
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
                title="Sair"
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

      {/* --- WORKSPACE --- */}
      <div className="flex-1 flex pt-14 h-full overflow-hidden">
        {/* --- LEFT DRAWER: MANUSCRIPTS & CHAPTERS --- */}
        <aside
          className={`fixed md:relative top-14 bottom-0 left-0 w-72 bg-stone-900 border-r border-stone-800 z-20 flex flex-col transition-transform duration-200 ${
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
                  if (selected) {
                    setActiveManuscript(selected);
                    setCurrentPdfUrl(null);
                  }
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
                + Criar primeiro romance
              </button>
            )}
          </div>

          {/* Active Manuscript Summary */}
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

          {/* Chapters & Scenes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="flex items-center justify-between px-1 py-1 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-stone-500 font-mono">
                Capítulos / Cenas em PDF
              </span>
              <button
                onClick={handleCreateScene}
                disabled={!activeManuscript}
                className="text-xs text-stone-400 hover:text-amber-500 transition-colors disabled:opacity-30"
                title="Adicionar Novo Capítulo/Cena"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {scenes.length === 0 ? (
              <div className="text-center py-8 text-stone-600 text-xs px-2">
                Nenhum capítulo criado ainda. Clique em + para começar.
              </div>
            ) : (
              scenes.map((scene, idx) => (
                <div
                  key={scene.id}
                  onClick={() => {
                    setActiveScene(scene);
                    setPdfScope('scene');
                    setSidebarOpen(false);
                  }}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                    activeScene?.id === scene.id && pdfScope === 'scene'
                      ? 'bg-stone-800 text-stone-100 border border-stone-700 shadow-xs'
                      : 'text-stone-400 hover:bg-stone-850 hover:text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                    <div className="truncate">
                      <div className="font-medium truncate">{scene.chapterTitle || `Capítulo ${idx + 1}`}</div>
                      {scene.sceneTitle && (
                        <div className="text-[10px] text-stone-500 truncate">{scene.sceneTitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-stone-500">
                      {scene.wordCount ? `${scene.wordCount}w` : 'Vazio'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteScene(scene.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-stone-600 hover:text-red-400 p-0.5 transition-opacity"
                      title="Excluir"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* --- MAIN PDF DELIVERY & WORKSPACE CANVAS --- */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#121211]">
          {activeScene ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Scene Info Ribbon (Top) */}
              <div className="h-10 border-b border-stone-800/80 bg-stone-900/50 px-4 sm:px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-stone-200">{activeScene.chapterTitle}</span>
                  {activeScene.sceneTitle && (
                    <>
                      <span className="text-stone-600">/</span>
                      <span className="text-stone-400">{activeScene.sceneTitle}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-stone-500">
                  <span>{activeScene.wordCount ? `${activeScene.wordCount} palavras` : '0 palavras'}</span>
                  <span>·</span>
                  <span className="text-amber-500/90">{activeManuscript?.genre || 'Ficção Adulta'}</span>
                </div>
              </div>

              {/* Central Area: Compilation Animation OR Integrated PDF Viewer */}
              <div className="flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-5 bg-stone-950">
                {isGenerating ? (
                  /* Editorial Compilation Animation */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-amber-600/10 border border-amber-600/30 flex items-center justify-center text-amber-500 animate-pulse">
                        <Printer className="w-10 h-10 stroke-1 text-amber-400" />
                      </div>
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 animate-ping" />
                    </div>

                    <h3 className="text-xl font-serif text-stone-200 mb-2">
                      Compilando Capítulo em PDF
                    </h3>
                    <p className="text-xs text-amber-500/90 font-mono mb-4 animate-pulse">
                      {generationStep}
                    </p>
                    <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
                      A inteligência artificial está compondo a narrativa com alta densidade literária e diagramando diretamente em formato de livro. O PDF será exibido em instantes.
                    </p>
                  </div>
                ) : currentPdfUrl ? (
                  /* Integrated In-App PDF Document Viewer */
                  <div className="flex-1 flex flex-col h-full overflow-hidden bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl">
                    {/* PDF Viewer Header Toolbar */}
                    <div className="h-12 border-b border-stone-800 px-4 sm:px-6 flex items-center justify-between bg-stone-900/90 shrink-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-serif font-medium text-stone-200 truncate">
                          {pdfScope === 'full' 
                            ? `${activeManuscript.title} (Livro Completo)` 
                            : `${activeScene.chapterTitle}${activeScene.sceneTitle ? ` — ${activeScene.sceneTitle}` : ''}`}
                        </span>
                        <span className="text-[10px] font-mono text-stone-500 ml-2 hidden sm:inline">
                          PDF Diagramado
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowRawText(!showRawText)}
                          className="text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                          title={showRawText ? 'Ver PDF' : 'Ver Texto da Cena'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={currentPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-medium border border-stone-700 transition-colors"
                          title="Abrir em Nova Aba"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Nova Aba</span>
                        </a>

                        <button
                          onClick={() => {
                            if (pdfScope === 'full') {
                              exportManuscriptToPdf(activeManuscript, scenes);
                            } else {
                              exportSingleSceneToPdf(activeManuscript.title, activeScene);
                            }
                          }}
                          className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-medium transition-all shadow-sm active:scale-[0.98]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar Arquivo PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* PDF Content Frame or Raw Text Viewer */}
                    <div className="flex-1 w-full h-full overflow-hidden bg-stone-950/80">
                      {showRawText ? (
                        <div className="p-6 overflow-y-auto h-full max-w-3xl mx-auto text-stone-300 font-serif text-sm leading-relaxed whitespace-pre-line">
                          {activeScene.content}
                        </div>
                      ) : (
                        <iframe
                          src={currentPdfUrl}
                          title="Visualizador de PDF"
                          className="w-full h-full border-0 rounded-b-2xl bg-stone-900"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  /* Zero State: Ready to Generate */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-500">
                    <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-600 mb-4">
                      <Printer className="w-8 h-8 stroke-1" />
                    </div>
                    <h3 className="text-lg font-serif text-stone-300 mb-1">
                      {activeScene.chapterTitle} — Pronto para Escrever
                    </h3>
                    <p className="text-xs text-stone-500 max-w-md mb-6 leading-relaxed">
                      Digite abaixo o que deve acontecer neste capítulo/cena e clique em <strong>&quot;Gerar PDF&quot;</strong>. A história será escrita em prosa literária imersiva e entregue diretamente em PDF.
                    </p>
                  </div>
                )}
              </div>

              {/* Scene Prompt & Director Box (Docked at the Bottom) */}
              <div className="p-3 sm:px-6 bg-stone-900 border-t border-stone-800 shrink-0 shadow-lg">
                <div className="flex items-start gap-3 max-w-5xl mx-auto">
                  <div className="w-8 h-8 rounded-lg bg-amber-600/10 border border-amber-600/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] uppercase tracking-wider font-mono text-stone-400">
                          Diretriz do Capítulo
                        </label>

                        {/* Model Selector Toggle */}
                        <div className="flex items-center bg-stone-950 p-0.5 rounded-lg border border-stone-800 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => setSelectedModel('gemini-2.5-flash')}
                            className={`px-2 py-0.5 rounded transition-colors ${
                              selectedModel === 'gemini-2.5-flash'
                                ? 'bg-amber-600 text-stone-950 font-bold shadow-xs'
                                : 'text-stone-400 hover:text-stone-200'
                            }`}
                            title="1.500 requisições/dia gratuitas, respostas ultra rápidas e sem limites de cota"
                          >
                            ⚡ Gemini Flash (Ilimitado)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                            className={`px-2 py-0.5 rounded transition-colors ${
                              selectedModel === 'gemini-3.1-pro-preview'
                                ? 'bg-amber-600 text-stone-950 font-bold shadow-xs'
                                : 'text-stone-400 hover:text-stone-200'
                            }`}
                            title="Modelo Pro (atenção: cota diária gratuita do Google muito restrita)"
                          >
                            🧠 Gemini Pro
                          </button>
                        </div>

                        <span className="text-[10px] bg-amber-600/20 text-amber-400 px-1.5 py-0.5 rounded font-mono hidden sm:inline">
                          Entrega em PDF
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400 font-mono hidden md:inline">
                        {activeManuscript?.tone ? `Tom: ${activeManuscript.tone.slice(0, 30)}...` : 'Ficção Adulta Irrestrita'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <textarea
                        rows={2}
                        value={promptOutline}
                        onChange={(e) => setPromptOutline(e.target.value)}
                        placeholder="O que deve acontecer neste capítulo? (ex: diálogos tensos, atrito físico, revelação secreta, ritmo cinematográfico)..."
                        className="flex-1 px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder:text-stone-600 focus:outline-hidden focus:border-amber-600 resize-none transition-colors"
                      />

                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleGeneratePdf('generate')}
                          disabled={isGenerating}
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-xl font-medium text-xs transition-all shadow-md active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isGenerating ? 'Compilando...' : 'Gerar PDF'}</span>
                        </button>

                        <button
                          onClick={() => handleGeneratePdf('continue')}
                          disabled={isGenerating || !activeScene.content}
                          title="Sem limites: expanda a história e receba o PDF atualizado"
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200 rounded-xl font-medium text-xs transition-colors disabled:opacity-40 whitespace-nowrap"
                        >
                          <FastForward className="w-3.5 h-3.5 text-amber-400" />
                          <span>Continuar</span>
                        </button>
                      </div>
                    </div>

                    {generationError && (
                      <div className="mt-2.5 flex items-start justify-between gap-2 p-2.5 rounded-lg bg-red-950/70 border border-red-800/80 text-red-200 text-xs">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{generationError}</span>
                        </div>
                        {selectedModel !== 'gemini-2.5-flash' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedModel('gemini-2.5-flash');
                              setGenerationError(null);
                            }}
                            className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded text-[11px] transition-colors"
                          >
                            Trocar para Flash &rarr;
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* No Manuscript / Scene Selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-500">
              <BookOpen className="w-14 h-14 stroke-1 mb-4 text-stone-700" />
              <h3 className="text-xl font-serif text-stone-300">Nenhum Manuscrito Selecionado</h3>
              <p className="text-xs text-stone-500 max-w-md mt-1 mb-6">
                Crie um novo romance para configurar a bíblia de personagens e gerar seus capítulos diretamente em PDF.
              </p>
              <button
                onClick={handleCreateManuscript}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium text-xs transition-all shadow-md active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Romance</span>
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
          setCurrentPdfUrl(null);
        }}
      />
    </div>
  );
}
