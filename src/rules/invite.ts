// Convite da apresentação: decide se o endereço desbloqueia o visual exclusivo. Sem DOM, testável.
import { INVITE } from "../content/texts";

/** Verdadeiro se o endereço (parte depois do "?") traz o convite certo; maiúsculas e espaços não importam. */
export function hasInvite(search: string): boolean {
  const v = new URLSearchParams(search).get("convite");
  return !!v && v.trim().toLowerCase() === INVITE.code;
}
