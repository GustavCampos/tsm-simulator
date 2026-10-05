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

## Como rodar

- Servidor local: `python3 -m http.server 8000` e abrir `http://localhost:8000/`.
- Testes: `npm test` (Node 18+).

## Questões em aberto

- Nenhuma por enquanto. Convenções seguem o SPEC §15.
