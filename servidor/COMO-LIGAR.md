# Como ligar o placar de todos os jogadores

O placar "Todos" do jogo guarda as pontuações numa planilha Google **sua**. A planilha continua privada:
ninguém consegue abri-la pelo jogo. O jogo só recebe os 20 melhores (apelido, pontos e tempo no alvo) e o
número de pessoas que já jogaram. Leva uns 10 minutos e é feito uma vez só.

## 1. Criar a planilha
1. Entre em <https://sheets.new> com uma conta Google. Uma conta Gmail pessoal costuma funcionar melhor:
   contas de instituição (como a @uepg.br) às vezes não deixam o placar ficar aberto ao público.
2. Dê um nome, por exemplo **Placar GlycoRun 2**.

## 2. Colar o script
1. Na planilha, menu **Extensões → Apps Script**.
2. Apague o que estiver escrito e cole todo o conteúdo do arquivo `servidor/placar.gs`.
3. Clique no disquete (**Salvar**).

## 3. Publicar como "app da Web"
1. Botão azul **Implantar → Nova implantação**.
2. Na engrenagem ao lado de "Selecione o tipo", escolha **App da Web**.
3. Preencha:
   - **Executar como:** Eu
   - **Quem pode acessar:** Qualquer pessoa
4. Clique em **Implantar** e depois em **Autorizar acesso**. Escolha sua conta.
   O Google mostra o aviso "O Google não verificou este app": é normal, porque o script é seu.
   Clique em **Avançado → Acessar Placar GlycoRun 2 (não seguro)** e em **Permitir**.
5. Copie o **URL do app da Web** (termina em `/exec`).

## 4. Ligar no jogo
Mande esse endereço para quem cuida do código. Ele vai em `src/content/online.ts`:

```ts
export const PLACAR_URL = "https://script.google.com/macros/s/.../exec";
```

Não é senha nem chave: é só o endereço do placar. Depois de publicado, a aba **Todos** passa a funcionar.

## No dia a dia
- **Tirar um apelido impróprio:** apague a linha dele na aba **Placar** da planilha.
- **Zerar o placar:** apague todas as linhas abaixo do cabeçalho.
- **Cada apelido é uma linha**, com a melhor pontuação. "Ana" e "ANA" contam como a mesma pessoa.
- O jogo já bloqueia palavrões no apelido, no aparelho e na planilha.
- Se alterar o script: **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar**.
  Assim o endereço continua o mesmo.

## Limites
- Num jogo aberto, alguém que entenda de programação consegue enviar uma pontuação falsa. O script aceita
  no máximo 120 envios por minuto e pontuações até 9.999.999. Se aparecer algo estranho, apague a linha.
- Sem internet, o jogo guarda até 5 pontuações e envia quando a conexão voltar.
