const MORSE: Record<string, string> = {
  O: "---",
  B: "-...",
  R: ".-.",
  I: "..",
  G: "--.",
  A: ".-",
  D: "-..",
  V: "...-",
  L: ".-..",
  E: ".",
  U: "..-",
  T: "-",
  C: "-.-.",
};

const WORD_POOL = ["OBRIGADO", "VALEU", "VOLTOU", "CDI"];

/** Escolhe a palavra Morse do farol: sempre "OBRIGADO" até a 3ª visita, depois varia. */
export function pickMorseWord(visitCount: number): string {
  if (visitCount < 3) return "OBRIGADO";
  return WORD_POOL[visitCount % WORD_POOL.length];
}

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
