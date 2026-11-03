// Escala da cena 3D. As regras usam faixas (-1, 0, 1); aqui viram metros do mundo 3D.
export const LANE_W = 2.2;
export const ROAD_W = LANE_W * 3 + 0.8;
export const VIEW_FAR = 150; // até onde a cena é desenhada (igual ao ponto onde os objetos nascem)

export const COLORS = {
  sky: 0x9fd8f2,
  fog: 0xbfe4f2,
  grass: 0x7cc35a,
  road: 0x5d6574,
  sidewalk: 0xd9d2c4,
  player: 0x2f7fe0,
  skin: 0xc98e66,
  sofa: 0xd0584c,
  tela: 0x2c6fd6,
  pilha: 0x353e50,
  item: 0x2fa866,
};
