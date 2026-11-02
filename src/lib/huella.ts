// Una huella corta y estable de un texto (FNV-1a de 32 bits, en hexadecimal). No es seguridad:
// sirve para dar nombre a una cookie por persona («ya vio la bienvenida», «ya pidió acceso»)
// sin escribir su correo en el nombre de la cookie. Pura, sin IO.
export function huella(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
