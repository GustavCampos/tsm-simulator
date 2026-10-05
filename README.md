# Simuladores de Modelos de Computação

Trabalho de Teoria da Computação e Complexidade (UNIJUÍ, 2026/2): simuladores de Máquina de Turing e Máquina de Duas Pilhas.

## Marco 1 — Motores e exemplos

Implementado:

- `js/turing/engine.js` e `js/two-stack/engine.js`: `normalize`, `validate`, `validateInput`, `initialConfig`, `step` (puros, sem DOM).
- `js/turing/format.js` e `js/two-stack/format.js`: `edgeLabel`, `deltaText`, `explain`, `configText`.
- `js/config.js`: `DEFAULT_SPEED`, `DEFAULT_STEP_LIMIT`, `MOVE_LABELS`.
- Exemplos em `examples/` conforme SPEC §13, com `tests` em cada arquivo.
- Testes em `tests/` com `node --test`.

## Marco 2 — Página da Máquina de Turing (sem diagrama)

Implementado:

- `turing.html`: layout com controles, faixa de estado, fita, transição atual, histórico e tabela de transições.
- `css/base.css`: tokens de desenho, layout, botões e faixa (com modo escuro via `prefers-color-scheme`).
- `css/machines.css`: fita, histórico, tabela e painel de transição.
- `js/core/runner.js`: passo a passo, execução automática (`setTimeout` encadeado), reiniciar, velocidade e limite de passos, com teste em `tests/runner.test.js`.
- `js/core/ui.js`, `history.js`, `loader.js`: faixa de estado, painel de histórico, exemplos e painel JSON.
- `js/turing/view.js` e `page.js`: fita com cabeçote animado e toda a fiação da página.
- Atalhos: `→` ou `N` próximo passo, `Espaço` executar/pausar, `R` reiniciar.

## Marco 3 — Diagrama de estados

Implementado:

- `js/core/diagram.js`: `createDiagram(svg, {states, transitions, initial, finals, edgeLabel})` com `highlight`, `clearHighlight`, `getPositions`, `relayout` e `destroy`.
- SVG próprio, sem bibliotecas: círculos (raio 24, interna 19 para finais), triângulo do estado inicial, setas com `marker`, laços acima do nó, pares opostos em curvas quadráticas opostas, retas nos demais casos, rótulos empilhados em ordem de definição.
- Posições de `x`/`y` ou layout automático em círculo (inicial à esquerda); `viewBox` ajustado com margem; arrasto com ponteiro (mouse e toque) atualiza arestas e rótulos; `Copiar JSON` exporta as posições atuais.
- Destaques: estado atual em amarelo (`--state-current`), aceita verde, rejeita vermelho, limite laranja; aresta ativa mais grossa em `--edge-active` com rótulo em negrito.
- Integrado em `turing.html`/`js/turing/page.js` e estilos em `css/machines.css`; layout com área `diagram` (projetor e 390 px).

## Marco 4 — Página da Máquina de Duas Pilhas

Implementado:

- `duas-pilhas.html`: mesmo layout da página de Turing, com legenda `leitura , desempilha P1 ; empilha P1 | desempilha P2 ; empilha P2` e tabela de 7 colunas (`Estado`, `Lê`, `Desempilha P1`, `Empilha P1`, `Desempilha P2`, `Empilha P2`, `Próximo`).
- `js/two-stack/view.js`: `createView(container, definition)` com fita de entrada (símbolos consumidos apagados, ponteiro `▼` na próxima a ler, texto `Entrada totalmente lida`) e duas pilhas lado a lado (fundo embaixo, topo destacado com etiqueta `topo`, `vazia` quando vazia, linha de última operação `Empilhou`/`Desempilhou`/`Sem alteração`, animações de empilhar/desempilhar com `prefers-reduced-motion` respeitado).
- `js/two-stack/page.js`: reutiliza `runner`, `history`, `diagram`, `loader` e `ui`; lê `examples/index.json` (`two-stack`), diagrama sincronizado, atalhos e painel JSON iguais aos da Turing.
- `css/machines.css`: estilos da fita de entrada e das pilhas (células ≥ 40 px, animações `stack-in`/`stack-out`, modo escuro herdado das variáveis).

## Como rodar

- Servidor local: `python3 -m http.server 8000` e abrir `http://localhost:8000/`.
- Testes: `npm test` (Node 18+).

## Questões em aberto

- Nenhuma por enquanto. Convenções seguem o SPEC §15.
