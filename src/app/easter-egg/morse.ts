const MORSE: Record<string, string> = {
  S: "...",
  N: "-.",
  A: ".-",
  K: "-.-",
  E: ".",
};

/** Palavra piscada pelo farol — pista para a página secreta /admin/<palavra>/. */
export const MORSE_WORD = "SNAKE";

export interface MorseSegment {
  on: boolean;
  duration: number;
  /** Marca visual (cor do farol) para sinalizar início/fim da mensagem — facilita saber onde ler. */
  signal?: "start" | "end";
}

/**
 * Gera a sequência on/off de um farol piscando em código Morse, em loop.
 * Antes da palavra, o farol pisca 2x em verde (começou a mensagem); depois
 * da última letra, pisca 1x em vermelho (mensagem terminou) e então pausa
 * antes de repetir — facilita saber onde a leitura começa e termina.
 */
export function buildMorseSchedule(word: string, unit = 260): MorseSegment[] {
  const segments: MorseSegment[] = [];
  const letters = word.toUpperCase().split("");

  // Aviso de início: 2 flashes verdes curtos
  segments.push({ on: true, duration: unit * 0.8, signal: "start" });
  segments.push({ on: false, duration: unit * 0.5 });
  segments.push({ on: true, duration: unit * 0.8, signal: "start" });
  segments.push({ on: false, duration: unit * 1.4 });

  letters.forEach((letter, li) => {
    const code = MORSE[letter];
    if (!code) return;
    code.split("").forEach((symbol, si) => {
      segments.push({ on: true, duration: symbol === "-" ? unit * 3 : unit });
      if (si < code.length - 1) {
        segments.push({ on: false, duration: unit });
      }
    });
    if (li < letters.length - 1) {
      segments.push({ on: false, duration: unit * 3 });
    }
  });

  // Aviso de fim: 1 flash vermelho mais longo, depois pausa antes de repetir
  segments.push({ on: false, duration: unit * 2 });
  segments.push({ on: true, duration: unit * 1.6, signal: "end" });
  segments.push({ on: false, duration: unit * 6 });
  return segments;
}
