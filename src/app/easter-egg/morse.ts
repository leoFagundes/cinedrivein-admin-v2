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
}

/** Gera a sequência on/off de um farol piscando em código Morse, em loop. */
export function buildMorseSchedule(word: string, unit = 260): MorseSegment[] {
  const segments: MorseSegment[] = [];
  const letters = word.toUpperCase().split("");

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

  segments.push({ on: false, duration: unit * 7 });
  return segments;
}
