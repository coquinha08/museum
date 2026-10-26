# Museum 2.0 — Entrega Automática e Visualizador de PDF Integrado

Plano para transformar a saída do assistente de escrita: ao enviar um comando, o sistema não exibirá blocos de texto comuns de chat, mas fará a geração em segundo plano com animação de compilação editorial e entregará o capítulo/cena pronto diretamente como um **PDF diagramado e legível na tela**, com botão de download.

---

## Decisões Críticas & Confirmações do Usuário

> [!IMPORTANT]
> **Decisões confirmadas:**
> 1. **Entrega Exclusiva em PDF:** O usuário não recebe texto puro editável na tela; ao pedir uma cena ou capítulo, a resposta do agente é o próprio documento PDF gerado e diagramado.
> 2. **Visualizador de PDF Integrado:** O PDF gerado é exibido diretamente dentro do aplicativo em um leitor de documentos interativo com controles de zoom, paginação e botão de download.
> 3. **Modo Direto com Animação de Compilação:** Durante a geração com o Gemini 3 Pro, a tela exibe uma elegante animação editorial de diagramação (status de escrita, montagem de páginas e paginação) em vez de despejar texto corrido, revelando o PDF final assim que a geração conclui.

---

## 1. Visão Geral & Nova Experiência do Usuário

Ao clicar em **"Gerar Capítulo / Cena em PDF"**:
1. **Fase de Composição:** A interface oculta a digitação crua e apresenta uma animação de compilação editorial de livro (*"Compondo narrativa com Gemini 3 Pro..."*, *"Diagramando tipografia e quebras de página..."*).
2. **Fase de Entrega Instantânea:** A biblioteca `jsPDF` compila o documento na memória com a capa, título, gênero, autor e o texto diagramado em fontes clássicas de livro físico.
3. **Leitor Integrado:** O PDF é renderizado na tela principal em um visualizador integrado com barra de ação rápida:
   - **Baixar PDF:** Salva o arquivo no celular ou computador.
   - **Abrir em Nova Aba:** Para leitura em tela cheia.
   - **Continuar Capítulo:** Permite gerar a próxima parte ou sequência direto no documento.

---

## 2. Mudanças na Interface & Arquitetura

### A. Substituição do Editor de Texto por Leitor de PDF
- Remoção do `<textarea>` de texto bruto como visualização primária.
- Inclusão de um componente **PDFViewer**:
  - Container responsivo (`<iframe src={pdfBlobUrl}>` estilizado com bordas da temática Museum e barra superior minimalista).
  - Suporte completo a navegação em celulares e computadores.

### B. Ciclo de Geração e Compilação
- O frontend envia a requisição para `/api/generate-scene` com o Gemini 3 Pro.
- O texto gerado é acumulado silenciosamente na memória e sincronizado com o Firestore.
- No final da geração, o gerador `exportManuscriptToPdf` / `exportSingleSceneToPdf` cria o `Blob` do PDF e define a URL do documento para renderização imediata.

---

## 3. Diagrama do Fluxo de Entrega do PDF

```
┌──────────────────────────────────────────────────────────────┐
│                    USUÁRIO ENVIA PROMPT                      │
│   (Diretrizes da cena + Contexto da Bíblia da Obra)          │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│         ESTADO DE ANIMAÇÃO DE COMPILAÇÃO EDITORIAL           │
│   "Gemini 3 Pro compondo..." -> "Diagramando páginas..."      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  COMPILADOR CLIENT-SIDE (jsPDF)              │
│   - Tipografia de Livro (Times / Serif)                      │
│   - Cabeçalho, quebras de cena e paginação centralizada      │
│   - Criação do Blob PDF em memória                           │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│           VISUALIZADOR DE PDF INTEGRADO NA TELA              │
│   - Leitura direta do PDF dentro do Museum 2.0               │
│   - Botões: [Baixar PDF] · [Abrir em Tela Cheia]             │
│   - Opção de "Continuar História" gerando novo PDF           │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Roteiro de Execução

1. **Atualização do Utilitário de PDF (`src/lib/pdfExport.ts`):**
   - Adicionar função `generateScenePdfBlob(manuscript, scene): string` que retorna a URL Blob para visualização imediata no navegador (além do download).
2. **Atualização da Interface Principal (`src/App.tsx`):**
   - Trocar a área central de escrita para exibir o **Visualizador de PDF Incorporado**.
   - Implementar a tela de carregamento e diagramação animada com status de progresso.
   - Gerar o PDF automaticamente ao término de cada geração e carregá-lo no leitor.
3. **Compilação e Verificação:**
   - Executar `vite build` e `compile_applet`.
   - Garantir que a renderização e o download funcionem tanto no ambiente web quanto no PWA mobile.
