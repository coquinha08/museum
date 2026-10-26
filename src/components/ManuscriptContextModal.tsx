import React, { useState } from 'react';
import { Manuscript } from '../types';
import { X, BookOpen, Globe, Lock, Save } from 'lucide-react';

interface ManuscriptContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript;
  onSave: (updated: Partial<Manuscript>) => Promise<void>;
}

export const ManuscriptContextModal: React.FC<ManuscriptContextModalProps> = ({
  isOpen,
  onClose,
  manuscript,
  onSave,
}) => {
  const [title, setTitle] = useState(manuscript.title);
  const [genre, setGenre] = useState(manuscript.genre || 'Ficção Adulta');
  const [synopsis, setSynopsis] = useState(manuscript.synopsis || '');
  const [tone, setTone] = useState(manuscript.tone || '');
  const [characters, setCharacters] = useState(manuscript.characters || '');
  const [worldRules, setWorldRules] = useState(manuscript.worldRules || '');
  const [visibility, setVisibility] = useState<'private' | 'shared'>(manuscript.visibility || 'private');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title,
        genre,
        synopsis,
        tone,
        characters,
        worldRules,
        visibility,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar contexto:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl p-6 sm:p-8 text-stone-100 shadow-2xl my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-200 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-600/30 flex items-center justify-center text-amber-500">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-stone-100">Bíblia da Obra & Contexto Central</h2>
            <p className="text-xs text-stone-400">
              O modelo Gemini 3 Pro consultará estas diretrizes a cada cena gerada.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Título da Obra</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: O Sussurro no Labirinto"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 placeholder:text-stone-600 focus:outline-hidden focus:border-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Gênero / Subgênero</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Ex: Dark Romance, Thriller Psicológico, Fantasia Sombria"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 placeholder:text-stone-600 focus:outline-hidden focus:border-stone-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Sinopse / Premissa Central</label>
            <textarea
              rows={3}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Descreva o conflito principal, o segredo da trama ou a jornada dos protagonistas..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 placeholder:text-stone-600 focus:outline-hidden focus:border-stone-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Tom Narrativo & Estilo de Prosa</label>
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Ex: Poético, cru e visceral, focado em diálogos tensos, detalhes corporais e ritmo cinematográfico..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 placeholder:text-stone-600 focus:outline-hidden focus:border-stone-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Bíblia de Personagens & Dinâmicas</label>
            <textarea
              rows={3}
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
              placeholder="Liste os personagens principais, aparências físicas marcantes, vícios, desejos proibidos e segredos..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 placeholder:text-stone-600 focus:outline-hidden focus:border-stone-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Regras do Mundo & Diretrizes Especiais</label>
            <textarea
              rows={2}
              value={worldRules}
              onChange={(e) => setWorldRules(e.target.value)}
              placeholder="Cenário, regras sociais, época histórica, ou restrições que a IA deve respeitar..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 placeholder:text-stone-600 focus:outline-hidden focus:border-stone-500 resize-none"
            />
          </div>

          {/* Visibility selector */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-stone-300 mb-2">Visibilidade na Plataforma</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors ${
                  visibility === 'private'
                    ? 'bg-stone-800 border-amber-600 text-stone-100'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-300'
                }`}
              >
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-stone-200">Privado</div>
                  <div className="text-[11px] text-stone-400">Apenas você pode ver e editar</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('shared')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors ${
                  visibility === 'shared'
                    ? 'bg-stone-800 border-amber-600 text-stone-100'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-300'
                }`}
              >
                <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-stone-200">Compartilhado</div>
                  <div className="text-[11px] text-stone-400">Visível na Biblioteca da comunidade</div>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-400 hover:text-stone-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium text-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Gravando...' : 'Salvar Contexto da Obra'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
