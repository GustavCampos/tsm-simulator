# Simuladores de Modelos de Computação

Trabalho de Teoria da Computação e Complexidade (UNIJUÍ, 2026/2): simuladores passo a passo de Máquina de Turing e Máquina de Duas Pilhas, com diagrama de estados estilo JFLAP, memória visível, transição atual, histórico das configurações e indicação clara de parada.

Páginas:

- `index.html`: página inicial para escolher o simulador.
- `turing.html`: Máquina de Turing (fita e cabeçote, importação JFLAP `.jff`).
- `duas-pilhas.html`: Máquina de Duas Pilhas (fita de entrada somente leitura e duas pilhas animadas).

Somente HTML, CSS e JavaScript puros, sem dependências e sem CDNs.

## Como usar

1. Abra a página inicial e escolha um simulador.
2. Escolha um exemplo no campo “Exemplo” ou cole uma definição no painel “Definição da máquina” e clique em “Aplicar JSON”.
3. Digite a entrada e clique em “Carregar entrada” (ou Enter). Campo vazio significa a palavra vazia, mostrada como `ε (palavra vazia)`. Use as pastilhas abaixo do campo para as entradas sugeridas.
4. Use “Executar próximo passo” para avançar uma transição, “Executar automaticamente” para rodar até parar (vira “Pausar” durante a execução) e “Reiniciar” para voltar ao passo 0.
5. Ajuste a “Velocidade” (50–2000 ms por passo, padrão 600 ms) e o “Limite de passos” (padrão 1000). Ao atingir o limite, a máquina para com “⚠ LIMITE DE PASSOS ATINGIDO”.
6. Acompanhe a faixa de estado no topo (`Pronta`, `Executando…`, `Pausada`, `✔ ACEITA`, `✘ REJEITA`, `⚠ LIMITE`), a linha `Estado atual · Passo`, o diagrama destacado, a transição atual (`δ` e explicação), o histórico e a tabela de transições.
7. No painel JSON, “Copiar JSON” inclui as posições atuais dos nós do diagrama (arraste os estados com mouse ou toque para reorganizar).

Atalhos (fora de campos de texto): `→` ou `N` próximo passo, `Espaço` executar/pausar, `R` reiniciar.

Na página de Turing há ainda o campo “Importar .jff (JFLAP)”: escolha um arquivo `.jff` de máquina de Turing de fita única. O alfabeto de entrada é inferido das leituras a partir do estado inicial; confira o aviso e corrija no painel JSON se preciso.

## Formato dos rótulos

Símbolos especiais: `ε` significa “nada” nos campos das transições (gravado como `""` no JSON; `"λ"` ainda é aceito na leitura por compatibilidade), `□` é o branco da fita de Turing, `ε` também indica a palavra vazia na interface.

- Turing, aresta: `a ; X , R` (lê `a`, escreve `X`, move `R`). Movimentos: `L`, `R`, `S` (configurável em `js/config.js` via `MOVE_LABELS`).
- Turing, δ: `δ(q0, a) = (q1, X, R)`.
- Duas pilhas, aresta: `a , ε ; A | ε ; ε`, no formato `leitura , desempilha P1 ; empilha P1 | desempilha P2 ; empilha P2`.
- Duas pilhas, δ: `δ(q0, a, ε, ε) = (qa, A, ε)`.
- Empilhar uma cadeia coloca o símbolo mais à esquerda no topo: empilhar `"AB"` sobre `Z` resulta em `Z B A` (fundo → topo), com `A` no topo.

## Como rodar localmente

Módulos ES e `fetch` não funcionam em `file://`. Sirva a pasta e abra no navegador:

```sh
python3 -m http.server 8000
# abrir http://localhost:8000/
```

Testes (Node 18+, sem dependências):

```sh
npm test
```

O comando roda `node --test tests/`, cobrindo os motores, os formatadores, o importador JFLAP, o runner e todos os `tests` de cada arquivo em `examples/`.

Layout verificado em 1366×768 (projetor) e 390 px de largura, com modo claro e escuro via `prefers-color-scheme`. Fonte base de 16 px, células de fita e pilha com pelo menos 40 px e alto contraste.

## Publicação (GitHub Pages)

O arquivo vazio `.nojekyll` na raiz desativa o Jekyll no GitHub Pages. Sem ele, o Jekyll tenta interpretar os `{{...}}` do JSDoc em `SPEC.md` como Liquid e a publicação falha (`Liquid syntax error`). O site é estático puro e não precisa do Jekyll.

## Uso de IA generativa

SPEC.md, AGENTS.md e o planejamento do projeto foram gerados com Claude Opus 5.5 via Claude Desktop. A execução foi feita com opencode rodando MuseSpark 1.3 Contributor com high thinking, uma única sessão por marco:

- Marco 1 — Motores e exemplos: `js/turing/engine.js`, `js/two-stack/engine.js`, formatadores, `js/config.js`, exemplos e testes.
- Marco 2 — Página de Turing sem diagrama: layout, runner, controles, faixa, transição atual, histórico, tabela e fita.
- Marco 3 — Diagrama de estados: `js/core/diagram.js` com SVG próprio, laços, pares opostos, arrasto e destaques; integrado à página de Turing.
- Marco 4 — Página de duas pilhas: fita de entrada e pilhas animadas, reutilizando runner, histórico, diagrama e loader.
- Marco 5 — Importação JFLAP: `js/turing/jff.js` com `parseJff` e testes com fixtures XML inline; campo de importação na página de Turing.
- Marco 6 — Acabamento: página inicial, atalhos, responsivo e projetor, modo escuro e este README.

## Questões em aberto

- Nenhuma por enquanto. Convenções seguem o SPEC §15.
