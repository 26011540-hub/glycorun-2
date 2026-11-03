// Mensagens do jogo, copiadas do GlycoRun original.
// Mudanças aprovadas pelo autor: faixa-alvo de 70–180 para 70–140 mg/dL; na hipoglicemia, "visão sem cor"
// virou "visão turva" (sintoma visual mais típico).

export const MSG = {
  start: "Mantenha a glicemia no verde (70–140 mg/dL)!",
  goodLow: (n: string) => `${n}: ajuda um pouco, mas carboidrato rápido corrige mais depressa.`,
  good: (n: string) => `${n}: fibra e nutrientes, sobe devagar.`,
  water: "Água: hidratação em dia.",
  exercise: "Exercício! A glicose baixa e a insulina age melhor.",
  medLow: "Cuidado: medicação com glicemia já baixa pode causar hipoglicemia.",
  med: "Adesão ao tratamento: a medicação ajuda a baixar a glicose.",
  fix: "Correção certa! 15 g de carboidrato rápido (regra dos 15).",
  insulinShield: "Escudo de Insulina segurou o pico! A insulina ajuda a glicose a entrar nas células.",
  bad: (n: string, reduced: boolean) => `Bip bip! ${n}: pico de açúcar!${reduced ? " (o exercício reduziu o pico)" : ""}`,
  ima: "Ímã de Fibras! As fibras puxam os bons nutrientes e seguram a absorção do açúcar.",
  tenis: "Tênis do Boost! Pulo duplo e o músculo capta mais glicose.",
  escudo: "Escudo de Insulina pronto para o próximo ultraprocessado.",
  aguaTHigh: "Água Turbo: hidratar ajuda o rim a eliminar parte do excesso. Quem baixa de verdade são insulina e exercício.",
  aguaT: "Água Turbo: hidratação extra! Na glicemia alta ela ajuda mais.",
  quizShield: "O escudo do quiz te protegeu!",
  hit: {
    sofa: "Sedentarismo! Pule o sofá (↑).",
    tela: "Tempo de tela demais! Abaixe (↓) para passar.",
    pilha: "Pilha de telas! Troque de faixa ou use o pulo duplo do Tênis.",
  },
  severeLow: "Hipoglicemia grave: precisou de ajuda. Corrija cedo com 15 g de carboidrato!",
  severeHigh: "Hiperglicemia grave: procure atendimento. Evite os picos!",
  warnLow: "Glicemia baixa! Tremor e visão turva: pegue refrigerante comum, suco ou bala.",
  warnHigh: "Glicemia alta! Visão embaçada: busque exercício e evite ultraprocessados.",
  day: (n: number) => `Dia ${n} começou! Bom dia, corredor(a).`,
  rain: "Começou a chover! Pista molhada.",
  bossStart: "Chefão Ultraprocessado! Desvie dos doces que ele lança!",
  bossWin: "Você venceu o Chefão Ultraprocessado! +500",
  bossLose: "O chefão foi embora. Na próxima, desvie de tudo!",
  plateStart: "Desafio do Prato! Monte ½ vegetais, ¼ proteína e ¼ carboidrato nas faixas marcadas.",
  plateFew: "Desafio do Prato: pegue mais itens da próxima vez! Metade vegetais, ¼ proteína, ¼ carboidrato.",
  plateWin: "Prato equilibrado! +400. Metade vegetais, ¼ proteína, ¼ carboidrato.",
  plateNoVeg: "Faltou vegetal: metade do prato deve ser salada e legumes.",
  plateCarb: "Carboidrato demais: ele deve ocupar só ¼ do prato.",
  plateBalance: "Faltou equilibrar: ¼ proteína e ¼ carboidrato.",
  quizOk: "Escudo contra obstáculos e pontos ×2 extras!",
  quizNo: "A glicemia oscilou. Na próxima você acerta!",
  overObstacles: "Os obstáculos do sedentarismo te pararam.",
  overLow: "A glicemia ficou baixa demais por muito tempo.",
  overHigh: "A glicemia ficou alta demais por muito tempo.",
  overSuffix: " Quanto mais tempo na faixa de 70 a 140 mg/dL, melhor o controle.",
};

export const INTRO =
  "Corra pela cidade, dia e noite, e mantenha a glicemia na faixa-alvo de 70 a 140 mg/dL. Na faixa verde seus pontos dobram. A cada 30 segundos tem quiz de Mito ou Verdade.";

export const ACHIEVEMENTS = [
  { id: "eugli", ic: "🏅", t: "Mestre da Euglicemia", d: "Mais de 80% do tempo na faixa verde." },
  { id: "atleta", ic: "🏃", t: "Atleta de Elite", d: "Pegou todos os itens de atividade física (mín. 3)." },
  { id: "detetive", ic: "🔎", t: "Detetive de Mitos", d: "Acertou 100% do quiz (mín. 2 perguntas)." },
] as const;

export const SKINS = [
  { id: "corredor", label: "Corredor" },
  { id: "fone", label: "Fone de ouvido" },
  { id: "mochila", label: "Mochila de hidratação" },
  { id: "acs", label: "ACS" }, // substitui o Estetoscópio (decisão do autor)
] as const;
export type SkinId = (typeof SKINS)[number]["id"];

export const SOURCES_INTRO =
  "As perguntas seguem as Diretrizes da Sociedade Brasileira de Diabetes (SBD). Conteúdo educativo: não substitui consulta com profissional de saúde.";

export const SOURCES: readonly { text: string; link?: string }[] = [
  { text: "Diretriz SBD: Diagnóstico de diabetes mellitus (atualização jul/2024): jejum, HbA1c e TTGO de 1 h e 2 h." },
  { text: "Diretriz SBD: Atividade física e exercício no pré-diabetes e DM2", link: "https://diretriz.diabetes.org.br/atividade-fisica-e-exercicio-no-pre-diabetes-e-dm2/" },
  { text: "Diretriz SBD: Terapia nutricional no pré-diabetes e DM2; Terapia nutricional no DM1 (2024)." },
  { text: "Diretriz SBD: Diagnóstico e prevenção de úlceras no pé diabético", link: "https://diretriz.diabetes.org.br/diagnostico-e-prevencao-de-ulceras-no-pe-diabetico/" },
  { text: "SBD: classificação e tratamento da hipoglicemia (níveis 1, 2 e 3; regra dos 15)." },
  { text: "Portal das diretrizes:", link: "https://diretriz.diabetes.org.br/" },
];

export const BOARD_INTRO =
  "Melhores corridas neste aparelho. Ideal para a apresentação na turma ou na UBS, todos jogando no mesmo computador ou celular.";
