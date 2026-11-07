/**
 * Placar de todos os jogadores do GlycoRun 2 (Google Apps Script).
 *
 * Fica preso a uma planilha da sua conta Google. A planilha continua PRIVADA: ninguém a abre pelo jogo.
 * O jogo só recebe os 20 melhores (apelido, pontos e tempo no alvo) e o total de jogadores.
 * Cada apelido ocupa uma linha, com a melhor pontuação dele. Para tirar alguém, apague a linha.
 *
 * Como ligar: veja servidor/COMO-LIGAR.md.
 * O filtro de palavrões repete o de src/rules/global.ts (mantenha os dois iguais).
 */
var ABA = "Placar";
var MOSTRAR = 20;
var NOME_MAX = 16;
var PONTOS_MAX = 9999999;
var ENVIOS_POR_MINUTO = 120;

function doGet() {
  return saida(lerTopo(null));
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return saida({ erro: "dados" }); }
  var n = limpar(String(d.n || ""));
  var s = Math.round(Number(d.s));
  var tir = Math.round(Number(d.tir));
  if (!n || nomeFeio(n)) return saida({ erro: "nome" });
  if (!(s >= 0 && s <= PONTOS_MAX) || !(tir >= 0 && tir <= 100)) return saida({ erro: "pontos" });

  // freio simples contra envios em massa
  var cache = CacheService.getScriptCache();
  var minuto = "min" + Math.floor(Date.now() / 60000);
  var feitos = Number(cache.get(minuto) || 0);
  if (feitos >= ENVIOS_POR_MINUTO) return saida({ erro: "ocupado" });
  cache.put(minuto, String(feitos + 1), 120);

  var chave = chaveDe(n);
  var trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    var aba = planilha();
    var achou = aba.getRange("E:E").createTextFinder(chave).matchEntireCell(true).findNext();
    if (achou) {
      var linha = achou.getRow();
      if (s > Number(aba.getRange(linha, 2).getValue())) aba.getRange(linha, 1, 1, 4).setValues([[n, s, tir, new Date()]]);
    } else {
      aba.appendRow([n, s, tir, new Date(), chave]);
    }
    cache.remove("topo");
  } finally {
    trava.releaseLock();
  }
  return saida(lerTopo(chave));
}

/** Os melhores, o total e (se pedido) a posição de um jogador. */
function lerTopo(chave) {
  var cache = CacheService.getScriptCache();
  if (!chave) {
    var guardado = cache.get("topo");
    if (guardado) return JSON.parse(guardado);
  }
  var linhas = planilha().getDataRange().getValues().slice(1).filter(function (r) {
    return String(r[0]) && Number(r[1]) >= 0;
  });
  linhas.sort(function (a, b) { return Number(b[1]) - Number(a[1]); });
  var resp = {
    top: linhas.slice(0, MOSTRAR).map(function (r) { return { n: String(r[0]), s: Number(r[1]), tir: Number(r[2]) }; }),
    total: linhas.length,
  };
  if (chave) {
    for (var i = 0; i < linhas.length; i++) if (String(linhas[i][4]) === chave) { resp.pos = i + 1; break; }
  } else {
    cache.put("topo", JSON.stringify(resp), 30);
  }
  return resp;
}

function planilha() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var aba = doc.getSheetByName(ABA);
  if (!aba) {
    aba = doc.insertSheet(ABA);
    aba.appendRow(["Apelido", "Pontos", "Tempo no alvo (%)", "Data", "Chave"]);
    aba.getRange("A:A").setNumberFormat("@");
    aba.getRange("E:E").setNumberFormat("@");
    aba.setFrozenRows(1);
  }
  return aba;
}

function saida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function limpar(t) {
  return t.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NOME_MAX);
}

function semAcento(t) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function chaveDe(n) {
  return semAcento(limpar(n));
}

// ----- filtro de palavrões (igual ao de src/rules/global.ts) -----
var LEET = { "4": "a", "@": "a", "3": "e", "1": "i", "!": "i", "0": "o", "5": "s", "$": "s", "7": "t" };
function espremer(t) { return t.replace(/(.)\1+/g, "$1"); }
function palavras(t) {
  return semAcento(t).replace(/[4@3105$7!]/g, function (c) { return LEET[c]; }).replace(/[^a-z]+/g, " ").trim().split(" ")
    .filter(function (x) { return x; }).map(espremer);
}
var INTEIRAS = ["cu", "cus", "rola", "pau", "corno", "fdp", "vsf", "pqp", "tnc", "krl", "crl", "bct", "pnc", "tmnc"].map(espremer);
var INICIO = ["puta", "puto", "porra", "merda", "bosta", "foda", "foder", "fodid", "fuder", "fudid", "viad", "otari", "babaca", "cacete", "bicha", "retardad", "nazi", "hitler", "vadia", "piranha", "safad", "idiota", "imbecil", "burro"].map(espremer);
var QUALQUER = ["caralh", "buceta", "boceta", "piroca", "arrombad", "punheta", "xoxota", "xereca", "filhadaputa", "vagabund", "cuzao", "kct"].map(espremer);
function nomeFeio(n) {
  var w = palavras(n), junto = espremer(w.join(""));
  return w.some(function (x) {
    return INTEIRAS.indexOf(x) >= 0 || INICIO.some(function (p) { return x.indexOf(p) === 0; });
  }) || QUALQUER.some(function (p) { return junto.indexOf(p) >= 0; });
}
