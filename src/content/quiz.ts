// Perguntas do quiz Mito ou Verdade — CÓPIA EXATA do GlycoRun original.
// Não altere sem aprovação do autor. tests/quiz.test.ts compara este arquivo com o GlycoRun.html.

export interface Question {
  q: string; // afirmação
  a: boolean; // true = verdade, false = mito
  e: string; // explicação
  s: string; // fonte
}

export const QUESTIONS: readonly Question[] = [
 {q:"Glicemia de jejum entre 100 e 125 mg/dL é considerada normal.",a:false,
  e:"É pré-diabetes. Normal é abaixo de 100 mg/dL; a partir de 126 mg/dL já é critério de diabetes.",s:"Diretriz SBD — Diagnóstico de DM (2024)"},
 {q:"Glicemia de jejum ≥ 126 mg/dL ou hemoglobina glicada (HbA1c) ≥ 6,5% são critérios para diagnosticar diabetes.",a:true,
  e:"Sim. Sem sintomas claros, um exame alterado isolado deve ser confirmado; jejum ≥ 126 e HbA1c ≥ 6,5% na mesma amostra já fecham o diagnóstico.",s:"Diretriz SBD — Diagnóstico de DM (2024)"},
 {q:"Um único exame alterado, sem nenhum sintoma, já basta para fechar o diagnóstico de diabetes.",a:false,
  e:"Se só um exame vier alterado, a diretriz orienta repetir para confirmar. A exceção é a glicemia ao acaso ≥ 200 mg/dL com sintomas típicos.",s:"Diretriz SBD — Diagnóstico de DM (2024)"},
 {q:"A glicemia 1 hora após a curva glicêmica (TTGO) passou a ser usada no diagnóstico de diabetes.",a:true,
  e:"Na atualização de 2024, a glicemia de 1 h no TTGO ≥ 209 mg/dL entrou como critério, e a SBD a considera mais prática que a de 2 h.",s:"Diretriz SBD — Diagnóstico de DM (2024)"},
 {q:"Quem tem diabetes nunca mais pode comer carboidratos.",a:false,
  e:"Mito. O foco é a qualidade: preferir vegetais, frutas, leguminosas, leite e grãos integrais e reduzir carboidratos refinados e açúcar adicionado.",s:"Diretriz SBD — Terapia nutricional no pré-DM e DM2"},
 {q:"Pessoas com diabetes podem comer frutas.",a:true,
  e:"Frutas fazem parte de uma alimentação saudável. São fontes de carboidrato com fibras, vitaminas e minerais, em porções adequadas.",s:"Diretriz SBD — Terapia nutricional no DM1 e DM2"},
 {q:"Comer fibras (verduras, frutas, grãos integrais) ajuda no controle da glicemia.",a:true,
  e:"A diretriz recomenda pelo menos 25 g de fibras por dia no DM2 para melhorar o controle glicêmico, de preferência vindas dos alimentos.",s:"Diretriz SBD — Terapia nutricional no pré-DM e DM2"},
 {q:"150 minutos por semana de atividade física moderada ajudam a prevenir o diabetes tipo 2.",a:true,
  e:"No pré-diabetes, a SBD recomenda no mínimo 150 min/semana de atividade aeróbica moderada e perda de pelo menos 7% do peso.",s:"Diretriz SBD — Atividade física no pré-DM e DM2"},
 {q:"Quem tem diabetes tipo 2 pode ficar vários dias seguidos sem se exercitar, desde que compense no fim de semana.",a:false,
  e:"A orientação é não ficar mais de 2 dias seguidos sem atividade, combinando exercícios aeróbicos e de força.",s:"Diretriz SBD — Atividade física no pré-DM e DM2"},
 {q:"Ficar muito tempo sentado faz mal mesmo para quem pratica exercício.",a:true,
  e:"O tempo sentado prolongado está ligado a piores desfechos independentemente do exercício. Vale levantar e se mexer ao longo do dia.",s:"Diretriz SBD — Atividade física no pré-DM e DM2"},
 {q:"Hipoglicemia é quando a glicose no sangue fica abaixo de 70 mg/dL.",a:true,
  e:"Nível 1: abaixo de 70. Nível 2: abaixo de 54. Nível 3: quando a pessoa fica confusa ou desmaia e precisa de ajuda de outra pessoa.",s:"SBD — Classificação da hipoglicemia"},
 {q:"Na hipoglicemia leve, deve-se comer 15 g de carboidrato rápido e medir a glicemia de novo após 15 minutos.",a:true,
  e:"É a regra dos 15. Exemplos: 1 colher de sopa de açúcar ou 150 ml de refrigerante comum. Se continuar abaixo de 70, repete.",s:"SBD — Tratamento da hipoglicemia"},
 {q:"Para corrigir uma hipoglicemia, refrigerante diet ou zero funciona tão bem quanto o comum.",a:false,
  e:"Mito. Refrigerante diet não tem açúcar e não sobe a glicose. A correção precisa de carboidrato rápido de verdade.",s:"SBD — Tratamento da hipoglicemia"},
 {q:"Tremor, suor frio, tontura e fome repentina podem ser sinais de hipoglicemia.",a:true,
  e:"São sintomas clássicos. Ao percebê-los, quem tem diabetes deve medir a glicemia e corrigir se estiver abaixo de 70 mg/dL.",s:"SBD — Hipoglicemia"},
 {q:"Pessoas com diabetes devem olhar os próprios pés todos os dias, inclusive entre os dedos.",a:true,
  e:"A inspeção diária dos pés e do interior dos calçados faz parte do autocuidado para prevenir úlceras.",s:"Diretriz SBD — Prevenção de úlceras no pé diabético"},
 {q:"O exame dos pés no posto de saúde só é necessário quando aparece uma ferida.",a:false,
  e:"Mito. Todas as pessoas com diabetes devem ter os pés examinados pelo menos uma vez por ano, mesmo sem lesão.",s:"Diretriz SBD — Prevenção de úlceras no pé diabético"},
 {q:"Crianças e adolescentes nunca têm diabetes tipo 2.",a:false,
  e:"Mito. O DM2 pode aparecer em jovens, principalmente com obesidade e histórico familiar, e deve ser investigado.",s:"Diretriz SBD — Classificação e diagnóstico"},
 {q:"O diabetes tipo 1 é causado por comer doce demais.",a:false,
  e:"Mito. O tipo 1 é autoimune: o próprio organismo destrói as células que produzem insulina. Não é culpa da alimentação.",s:"Diretriz SBD — Classificação do DM"},
 {q:"Glicemia muito alta pode causar muita sede e vontade frequente de urinar.",a:true,
  e:"Sede excessiva, urina em excesso, cansaço e perda de peso sem explicação são sinais de hiperglicemia e merecem avaliação.",s:"Diretriz SBD — Diagnóstico de DM"},
];
