# Critique de Design Impeccable: Auditoria Integral do Criticbox

**Data**: 2026-09-29  
**Alvo**: Projeto Completo (HomePage, MovieDetailPage, SearchPage, ReviewModal, AuthModal, ReviewCard)  
**Método**: Auditoria Integrada e Análise Heurística Heuristics 10 (Dual Assessment Synthesis)  
**Modo**: Operate & Read (Catálogo Cinematográfico & Rede de Críticas)

---

## 1. Design Health Score (Nielsen's 10 Heuristics)

| Heurística | Nota (0–4) | Status | Diagnóstico |
|---|:---:|:---:|---|
| **1. Visibilidade do Status do Sistema** | 4 | Excelente | Ledgers de avaliação e kickers técnicos fornecem clareza imediata sobre estado, tipo de mídia e notas. |
| **2. Correspondência entre Sistema e Mundo Real** | 4 | Excelente | Terminologia cinematográfica precisa (Lançamento, Direção, Temporada/Episódio, ClassInd BR, Bilheteria). |
| **3. Controle do Usuário e Liberdade** | 3 | Bom | Botão "Voltar" funcional; modais fecham no overlay e tecla de escape; falta apenas filtro de gênero direto na tela de busca vazia. |
| **4. Consistência e Padrões** | 3 | Alerta | O Hero e MovieDetail foram alinhados ao Industrial Brutalist, mas `AuthModal` e o seletor de escopo de séries no `ReviewModal` estavam desprovidos de CSS no `index.css`. |
| **5. Prevenção de Erros** | 3 | Bom | Trava de avaliação para títulos não lançados (`unreleased`) e prevenção de duplicata com badge `VOCÊ JÁ AVALIOU`. |
| **6. Reconhecimento em vez de Memorização** | 4 | Excelente | Notas duplas TMDB vs Criticbox visíveis em cada card e página; chips de spoilers protegem leitura involuntária. |
| **7. Flexibilidade e Eficiência de Uso** | 3 | Bom | Atalho de busca no header com Enter; paginação clara; falta atalho de gêneros na busca inicial. |
| **8. Estética e Design Minimalista** | 4 | Excelente | Doutrina Zero-Radius, paleta Noir/Amber `#ff9900`, tipografia Outfit/JetBrains Mono estritamente aplicada nos blocos atualizados. |
| **9. Ajuda para Reconhecer e Recuperar Erros** | 3 | Bom | Mensagens de toast presentes; alerta de busca sem resultados presente. |
| **10. Ajuda e Documentação** | 4 | Excelente | DESIGN.md e sidecar .impeccable/design.json formalizados e documentados. |

**Score Consolidado: 35/40 (Nível: Excelente / Industrial Brutalist)**

---

## 2. Diagnóstico Detalhado por Parte do Projeto

### A. HomePage (`HomePage.jsx`)
- **Pontos Fortes**: Hero brutalista com Kicker em Space Grotesk, títulos imponentes em Outfit uppercase, dual ledger de pontuação (TMDB vs Criticbox) e remoção completa da "badge soup" sobre os pôsteres.
- **Oportunidades**: O banner CTA inferior foi refinado, mantendo a coerência terminal com sombras sólidas.

### B. MovieDetailPage (`MovieDetailPage.jsx`)
- **Pontos Fortes**: Hero com backdrop imersivo, pôster emoldurado com sombra sólida `8px 8px 0 0 #ff9900`, kicker linear sem fragmentação e ledger de 3 métricas em JetBrains Mono.
- **Defeitos Identificados**:
  1. *Anti-Pattern de Raio*: Em `index.css` linhas 2505 e 3224, logos de provedores de streaming (`.hero-streaming-logo-img`, `.simple-streaming-badge img`) continham `border-radius: 2px` e `border-radius: 3px`, violando a doutrina Zero-Radius.
  2. *Estado Vazio Inline*: O bloco de "Nenhuma avaliação para este título ainda" usava tags com CSS inline direto em vez de uma classe brutalista dedicada `.detail-reviews-empty`.

### C. ReviewModal (`ReviewModal.jsx`)
- **Defeitos Críticos**:
  1. *Falta de Estilização em Séries*: As classes `.scope-section`, `.scope-tabs`, `.scope-tab`, `.scope-body`, `.scope-fields`, `.scope-field`, `.scope-field-label`, `.scope-select`, `.scope-series-info`, `.scope-series-pill`, `.scope-series-desc` não existiam no `index.css`. Ao avaliar uma série ou episódio de TV, a interface quebrava para controles não estilizados do navegador.
  2. *Sombra Suave (SaaS Slop)*: O container `.v1-card` ainda usava `box-shadow: 0 25px 60px rgba(0, 0, 0, 0.95)`, uma sombra difusa típica de bibliotecas genéricas, em vez da sombra sólida brutalista `8px 8px 0 0 #ff9900`.
  3. *Seletor de Estrelas*: Necessita de indicador numérico de alta precisão e blocos de nota nítidos.

### D. AuthModal (`AuthModal.jsx`)
- **Defeito Crítico**:
  1. *Total Ausência de CSS*: As classes `.auth-card`, `.auth-tabs`, `.auth-tab`, `.auth-error`, `.auth-input-group`, `.auth-modal-overlay` não estavam estilizadas no `index.css`. Ao clicar em "Entrar" ou "Criar Conta", o formulário renderizava desalinhado.
  2. *Aparência Desconectada*: Deve refletir o mesmo bloco brutalista Noir/Amber do `ReviewModal`.

### E. SearchPage (`SearchPage.jsx`)
- **Defeitos Identificados**:
  1. *Estado Inicial Morto*: Ao acessar `/search` sem parâmetros, a página renderizava um grid vazio sem qualquer conteúdo ou instrução interativa. Deve oferecer badges de "Busca Rápida por Gênero" (Ação, Drama, Ficção Científica, Animação, etc.).
  2. *Paginação Genérica*: Os botões de paginação necessitam do acabamento angular terminal com contadores JetBrains Mono ("PÁG 01 // 15").

### F. ReviewComment & Spoilers (`ReviewComment.jsx`)
- **Defeito Crítico**:
  1. *Falta de CSS para Spoilers*: As classes `.spoiler-wrap`, `.spoiler-blurred` e `.spoiler-toggle` não estavam implementadas no `index.css`. O blur de spoiler não funcionava visualmente.

---

## 3. Plano de Correções Imediatas

1. **`index.css`**:
   - Implementar estilos brutalistas completos para o `AuthModal` (`.auth-modal-overlay`, `.auth-card`, `.auth-tabs`, `.auth-tab`, `.auth-input-group`, `.auth-error`).
   - Implementar estilos industriais para o seletor de escopo de séries no `ReviewModal` (`.scope-section`, `.scope-tabs`, `.scope-tab`, `.scope-fields`, `.scope-select`, etc.).
   - Implementar estilos para o blur e botão de revelação de spoilers (`.spoiler-wrap`, `.spoiler-blurred`, `.spoiler-toggle`).
   - Substituir sombras difusas no modal por hard offset shadows (`8px 8px 0 0 #ff9900`).
   - Eliminar qualquer resquício de `border-radius` em logos e ícones de streaming.
   - Adicionar estilos para o estado vazio de críticas `.detail-reviews-empty`.

2. **`SearchPage.jsx`**:
   - Adicionar seção de exploração rápida de gêneros no estado inicial.
   - Refinar botões e paginação.

3. **`ReviewModal.jsx`**:
   - Harmonizar inputs, seletor de notas e botões.

4. **`MovieDetailPage.jsx`**:
   - Padronizar o estado vazio de críticas e remover CSS inline residual.
