// Contador de leituras/escritas do Firestore, só para o painel Dev Mode.
// Estado em memória (reseta ao recarregar a página) — de propósito, pra
// refletir "desde que essa aba foi aberta", igual uma aba de Rede do
// navegador. Mesmo padrão de evento já usado em devMode.ts.

let reads = 0;
let writes = 0;

function dispatch(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("firestoredev:change"));
  }
}

/** Chame depois de uma leitura real (getDoc/getDocs/onSnapshot) já ter acontecido. */
export function recordFirestoreRead(count: number = 1): void {
  if (count <= 0) return;
  reads += count;
  dispatch();
}

/** Chame depois de uma escrita real (setDoc/updateDoc/addDoc/deleteDoc) já ter acontecido. */
export function recordFirestoreWrite(count: number = 1): void {
  if (count <= 0) return;
  writes += count;
  dispatch();
}

export function getFirestoreDevStats(): { reads: number; writes: number } {
  return { reads, writes };
}

export function resetFirestoreDevStats(): void {
  reads = 0;
  writes = 0;
  dispatch();
}
