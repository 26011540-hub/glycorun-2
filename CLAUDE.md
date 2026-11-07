# GlycoRun 2 — regras do projeto

Jogo educativo sobre diabetes (Disciplina Integradora, Medicina). Corredor infinito 3D de 3 faixas, jogado
principalmente no celular em pé, em aula ou em UBS, por adultos e crianças.

## Referência
- `GlycoRun.html` é o jogo original: **referência de regras e conteúdo**, não de visual. Não apagar.
- Plano aprovado: etapas 1 a 5 (protótipo → regras → arte 3D → interface/som → otimização e publicação).
  Parar ao fim de cada etapa para o usuário testar. Um commit por etapa concluída.

## Conteúdo protegido
- Perguntas do quiz, respostas, explicações e fontes: **cópia exata** do original, em `src/content/quiz.ts`.
  Qualquer mudança deve ser proposta ao usuário antes. `tests/quiz.test.ts` compara com o `GlycoRun.html`.
- Faixa-alvo decidida pelo usuário: **70–140 mg/dL** (o original usava 70–180). Zonas: <54 vermelho,
  54–69 amarelo (hipo), 70–140 verde, 141–250 amarelo (hiper), >250 vermelho.
- Visuais do personagem: Corredor, Fone de ouvido, Mochila de hidratação, ACS (substitui o Estetoscópio).
- O corpo do personagem fica mais largo com condicionamento baixo (decisão do usuário), de forma suave e não caricata.
- Hipoglicemia aparece como visão turva e dupla (decisão do usuário; o original usava visão sem cor).

## Arquitetura (manter separado)
- `src/content/` — textos, quiz, itens, conquistas. Só dados.
- `src/rules/` — lógica pura do jogo em TypeScript. **Não importa Three.js nem DOM.** Testável com Vitest.
- `src/render/` — Three.js. Lê o estado das regras e desenha; nunca muda regras.
- `src/ui/` — HTML/CSS (menus, HUD, quiz). O HUD nunca cobre a pista nem os objetos que se aproximam.
- `src/input/` — deslizar na tela e teclado, convertidos em ações (`L`, `R`, `U`, `D`).
- `src/audio/`, `src/core/` — som, laço do jogo, salvamento.

## Unidades
- Nas regras, `lane` vai de -1 a 1 e `z` é a distância à frente do jogador (unidades do original; 3 unidades = 1 m).
- No 3D, cada faixa tem `LANE_W` unidades de largura (ver `src/render/config.ts`).

## Técnica
- Vite + TypeScript + Three.js. `npm run dev` (jogo), `npm test` (regras), `npm run build` (publicação).
- Meta: 60 fps em celular intermediário. Reutilizar objetos (pools), evitar criar geometria/material por quadro.
- Arte 3D feita em código (`src/render/builder.ts` junta formas simples num modelo só; `src/render/body.ts` gera o corpo
  contínuo do personagem com esqueleto e deformação de engordar). Recursos externos só com
  licença livre (CC0 de preferência), registrados em `CREDITOS.md`.
- No modo dev, `window.__glyco` permite avançar quadros (`advance`) e salvar capturas em `.debug/` (`shot`).
- Qualidade gráfica em `src/core/quality.ts` (automática baixa um nível abaixo de ~48 fps). Sintomas de hipo/hiper
  são desenhados no 3D (`src/render/post.ts`), só quando há sintoma.
- Offline: `public/sw.js` guarda o jogo na primeira visita; troque `VERSION` quando mudar a estratégia de cache.
- Publicação: `.github/workflows/deploy.yml` roda testes e publica no GitHub Pages a cada push na `main`.
- Nunca colocar senhas, tokens ou chaves no código.
- Explicações em português simples: quem pediu o jogo não programa.
- Nunca dizer que algo funciona sem ter rodado e verificado.
