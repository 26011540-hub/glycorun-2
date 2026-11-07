# GlycoRun 2

Jogo educativo sobre diabetes: um corredor infinito em 3D em que você mantém a glicemia na faixa-alvo
(70–140 mg/dL) enquanto corre por um bairro brasileiro. Feito para a Disciplina Integradora (Medicina),
para aula e UBS, no celular ou no computador. Conteúdo do quiz baseado nas Diretrizes da SBD.

## Jogar no computador (para testar)
Precisa do [Node.js](https://nodejs.org) instalado. Na pasta do jogo:

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Para testar no celular, use `npm run dev -- --host` e abra no celular
o endereço "Network" mostrado no terminal (celular e computador no mesmo Wi-Fi).

- `npm test` — testes automáticos (regras, quiz idêntico ao original, qualidade gráfica).
- `npm run build` — gera a versão de publicação na pasta `dist/`.
- `?fps` no fim do endereço mostra quadros por segundo e desenhos por quadro.
- `?arco` no fim do endereço faz o arco da UEPG aparecer cerca de 10 segundos depois do início (no jogo normal ele aparece no Dia 5).
- `?bruce` no fim do endereço faz o Dr. Bruce atravessar a rua logo no início (no jogo normal é aos 45 m).

## Publicar grátis no GitHub Pages (uma vez só)
1. Crie uma conta em https://github.com (se ainda não tiver) e entre nela.
2. Crie um repositório novo: botão **New**, nome `glycorun-2`, **Public**, sem README. Clique em **Create repository**.
3. Na pasta do jogo, rode (troque `SEU-USUARIO` pelo seu usuário do GitHub):
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/glycorun-2.git
   git push -u origin main
   ```
   O Git vai pedir para você entrar na conta do GitHub (uma janela do navegador abre).
4. No repositório, abra **Settings → Pages** e, em **Source**, escolha **GitHub Actions**.
5. Abra a aba **Actions**: a publicação roda sozinha (uns 2 minutos). Quando ficar verde, o jogo
   estará em `https://SEU-USUARIO.github.io/glycorun-2/`.

Depois disso, cada `git push` publica a nova versão automaticamente. Se algum teste falhar,
a publicação para e a versão anterior continua no ar.

### Sem internet na UBS
Abra o link uma vez com internet: o jogo fica guardado no aparelho e abre depois mesmo sem conexão.
No celular, use "Adicionar à tela inicial" para ele abrir como um aplicativo, em tela cheia.

## Organização do código
- `src/content` — textos, quiz, itens (cópia do jogo original; o quiz não pode mudar sem revisão).
- `src/rules` — regras do jogo (glicemia, itens, chefão, prato, placar), sem gráficos. Testadas em `tests/`.
- `src/render` — 3D (Three.js): personagem, cenários, itens, céu, partículas.
- `src/ui` — menus, HUD e telas. `src/audio` — sons e música gerados no navegador.
- `src/core/quality.ts` — qualidade gráfica automática.

Créditos e licenças: veja `CREDITOS.md`. Regras do projeto: veja `CLAUDE.md`.

## Placar de todos os jogadores
A aba **Todos** do placar mostra um pódio com a melhor pontuação de cada pessoa que já jogou. Ela usa uma planilha Google
privada; o passo a passo para ligar está em `servidor/COMO-LIGAR.md`.
