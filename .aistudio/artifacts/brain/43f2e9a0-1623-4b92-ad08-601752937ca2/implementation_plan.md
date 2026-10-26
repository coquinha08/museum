# Museum 2.0 — Agente Literário & Estúdio de Ficção na Web

Plano de reestruturação arquitetural e de produto para transformar o **Museum** em um assistente/agente de escrita literária profissional e irrestrito na web, com autenticação multiusuário via Firebase, modelo **Gemini 3 Pro**, gestão de contexto de mundo e cenas, bibliotecas individuais/compartilhadas e exportador diagramado em PDF.

---

## Decisões Críticas & Confirmações do Usuário

> [!IMPORTANT]
> **Decisões confirmadas para esta fase:**
> 1. **Autenticação:** Firebase Auth com suporte a **Google Sign-In** e **Email/Senha**, com tela de login/cadastro limpa e intuitiva.
> 2. **Modelo de IA:** **Gemini 3 Pro** (`gemini-3.1-pro-preview`) com instruções de ficção adulta irrestrita, filtros desativados (`BLOCK_NONE`), streaming em tempo real e capacidade de geração contínua (sem cortes de tamanho).
> 3. **Modo Agente de Escrita:** Painel de **Contexto Central da Obra** (premissa, personagens, tom, regras do mundo) + **Sequenciador de Cenas e Capítulos**, onde o autor fornece batidas/esboços e o agente desenvolve com prosa rica e sensorial.
> 4. **Biblioteca Híbrida:** Espaço privado do autor para seus projetos pessoais + aba de **Biblioteca Compartilhada** (onde manuscritos podem ser publicados ou marcados como colaborativos).
> 5. **Exportação em PDF:** Sistema de diagramação em PDF com paginação, índice, quebras de cena e tipografia editorial de livro físico pronta para impressão e leitura.

---

## 1. Visão Geral & Conceito Central

O **Museum 2.0** evolui de um simples chat linear para uma **plataforma completa de criação e expansão literária**. O escritor define o "Cérebro do Livro" (Sinopse, tom narrativo, elenco e diretrizes de estilo) e trabalha capítulo por capítulo ou cena por cena. O agente atua como co-autor irrestrito: lê o contexto global e escreve cenas longas, intensas e sem filtros censórios.

### Perfis de Uso & Casos Principais
- **Autores de Ficção Adulta & Dark Romance:** Cenas detalhadas, diálogos crus e descrições sem bloqueios de segurança artificiais.
- **Romancistas de Fantasia & Sci-Fi:** Criação de universos com bíblia de personagens e geração de capítulos extensos com continuidade narrativa.
- **Criadores de Contos & Roteiros:** Exportação imediata em PDF limpo e formatado para leitura móvel ou compartilhamento.

---

## 2. Experiência do Usuário & Design Editorial

Seguindo as diretrizes de design editorial do **Museum Institutional Style**:
- **Paleta de Cores:**
  - *Fundo Primário:* Papel de arquivo suave (`#FBF9F5` no modo claro; ardósia/carvão literário `#141413` no modo escuro).
  - *Superfícies:* Cartões com bordas sutis de 1px hairline (`border-stone-200` / `border-stone-800`), sem pílulas coloridas ou sombras plásticas.
  - *Tipografia:* Combinação de serif editorial para títulos de capítulos e prosa (*Playfair Display* / *Lora* / *Source Serif 4*) com sans-serif cristalina para ferramentas de edição (*Plus Jakarta Sans*).
- **Estrutura de 3 Painéis do Estúdio:**
  1. **Barra Lateral do Manuscrito:** Lista de capítulos, cenas, alternância entre biblioteca privada e obras compartilhadas, e botão de novo projeto.
  2. **Painel do Agente & Contexto (Bíblia da História):** Ficha rápida de personagens ativos, tom da cena e objetivos que a IA deve cumprir.
  3. **Canvas de Escrita & Leitura:** Visualizador tipográfico com contagem de palavras, streaming ao vivo da IA, botão de "Continuar Escrevendo" (expansão infinita) e "Exportar PDF Diagramado".
- **Fluxo de Autenticação Elegante:**
  - Tela de acesso modal que não interrompe a estética literária, permitindo entrar com 1 clique via Google ou criar conta por e-mail/senha.

---

## 3. Decisões de Produto & Arquitetura Técnica

### A. Autenticação e Armazenamento (Firebase)
- **Firebase Auth:** Google OAuth (com `signInWithPopup` otimizado para navegadores e PWAs) + Cadastro de Email/Senha.
- **Firestore Database:** 
  - Coleção `users`: perfis de escritores.
  - Coleção `manuscripts`: metadados da obra, visibilidade (`private` ou `shared`), contexto global.
  - Subcoleção `chapters` / `scenes`: conteúdo textual das cenas, notas do autor e ordem sequencial.
  - Regras de segurança completas e auditadas (apenas o autor edita seus textos privados; projetos compartilhados permitem leitura pública).

### B. Integração do Gemini 3 Pro (`gemini-3.1-pro-preview`)
- **Backend Seguro (`/api/generate`):**
  - Prompt com injeção automática de:
    1. *Diretrizes Absolutas de Ficção Adulta:* `BLOCK_NONE` em todas as categorias de dano.
    2. *Contexto Central da Obra:* Sinopse, personagens e tom.
    3. *Histórico e Cena Anterior:* Para garantir fluidez sem repetições.
    4. *Esboço da Cena Atual:* Diretivas do usuário para guiar a escrita.
  - **Suporte a Textos Ilimitados:** Função de expansão ("Continuar Cena / Aprofundar") enviando o final da resposta anterior para o modelo prosseguir perfeitamente sem interrupções.

### C. Mecanismo de Entrega em PDF
- Módulo cliente dedicado (`jspdf` + estilos de diagramação de livros):
  - Capa com título da obra, subtítulo e autor.
  - Numeração de páginas rodapé estilizada.
  - Títulos de capítulos centralizados em serif com espaçamento editorial.
  - Quebras de cena com marcadores sutis (`* * *`).
  - Margens padrão para impressão (A4 / Formato Livro).

---

## 4. Diagrama da Arquitetura & Fluxo de Dados

```
┌────────────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR / PWA                               │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │     Firebase Auth     │  │          Estúdio Museum 2.0           │  │
│  │ (Google + Email/Pass) │  │  - Contexto Central (Sinopse/Regras)  │  │
│  └───────────┬───────────┘  │  - Sequenciador de Cenas/Capítulos    │  │
│              │              │  - Biblioteca Privada & Compartilhada │  │
│              │              │  - Exportador PDF Diagramado          │  │
│              ▼              └───────────────────┬───────────────────┘  │
│      [Token de Usuário]                         │                      │
└──────────────┼──────────────────────────────────┼──────────────────────┘
               │                                  │
               ▼                                  ▼
┌───────────────────────────────┐ ┌──────────────────────────────────────┐
│       FIREBASE BACKEND        │ │        EXPRESS SERVER (Node.js)      │
│                               │ │                                      │
│  - users/{userId}             │ │  POST /api/generate-scene            │
│  - manuscripts/{docId}        │ │   ├─ Validação de Auth               │
│  - chapters/{sceneId}         │ │   ├─ Agente com Gemini 3 Pro         │
│  - firestore.rules (ABAC)     │ │   ├─ System Instruction sem limites  │
│                               │ │   └─ Streaming Server-Sent Events    │
└───────────────────────────────┘ └───────────────────┬──────────────────┘
                                                      │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │    @google/genai SDK         │
                                       │    gemini-3.1-pro-preview    │
                                       │    (BLOCK_NONE, Streaming)   │
                                       └──────────────────────────────┘
```

---

## 5. Roteiro de Execução

1. **Ativação e Provisão do Firebase:**
   - Solicitar autorização e provisionar Firestore e Firebase Auth via ferramentas da plataforma.
   - Criar `firebase-blueprint.json` e implementar as regras de segurança `firestore.rules` com testes de permissão.
2. **Camada de Autenticação & Contexto de Usuário:**
   - Implementar tela de Login/Cadastro (Google + Email/Senha).
   - Gerenciamento de sessão e persistência de usuário no cliente.
3. **Reestruturação do Backend para o Agente Literário:**
   - Atualizar rota `/api/generate` para usar `gemini-3.1-pro-preview`.
   - Adicionar modo de continuação ilimitada de cenas com streaming contínuo.
4. **Interface do Estúdio Literário:**
   - Painel de Contexto Central (Sinopse, tom, personagens).
   - Gestão de Capítulos e Cenas com organização visual.
   - Alternância entre Biblioteca Privada e Obras Compartilhadas.
5. **Mecanismo de Exportação em PDF:**
   - Instalação e configuração de diagramação tipográfica em PDF.
   - Download de capítulos individuais ou da obra completa com um clique.
6. **Verificação & Testes de Compilação:**
   - Teste de build completo e validação de todos os fluxos.
