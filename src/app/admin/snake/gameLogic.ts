export type Direction = "up" | "down" | "left" | "right";

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  snake: Point[]; // cabeça no índice 0
  direction: Direction;
  food: Point;
  score: number;
  gameOver: boolean;
  gridSize: number;
}

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITE[a] === b;
}

/** Escolhe uma célula livre para a comida — nunca sorteia em cima da cobra. */
export function pickFoodCell(snake: Point[], gridSize: number): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  // Grade cheia (vitória absoluta) — não deveria acontecer na prática.
  if (free.length === 0) return snake[0];
  return free[Math.floor(Math.random() * free.length)];
}

export function createInitialState(gridSize: number): GameState {
  const mid = Math.floor(gridSize / 2);
  const snake: Point[] = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  return {
    snake,
    direction: "right",
    food: pickFoodCell(snake, gridSize),
    score: 0,
    gameOver: false,
    gridSize,
  };
}

/**
 * Avança o jogo em um passo. Pura — recebe o estado atual e a direção
 * solicitada, devolve o novo estado. Reversões instantâneas (ex: indo para a
 * direita e pedindo esquerda) são ignoradas, mantendo a direção atual.
 */
export function step(state: GameState, requestedDirection: Direction): GameState {
  if (state.gameOver) return state;

  const direction = isOpposite(state.direction, requestedDirection)
    ? state.direction
    : requestedDirection;

  const delta = DELTA[direction];
  const head = state.snake[0];
  const newHead: Point = { x: head.x + delta.x, y: head.y + delta.y };

  const hitWall =
    newHead.x < 0 ||
    newHead.x >= state.gridSize ||
    newHead.y < 0 ||
    newHead.y >= state.gridSize;

  if (hitWall) {
    return { ...state, direction, gameOver: true };
  }

  const eating = newHead.x === state.food.x && newHead.y === state.food.y;

  // Quando NÃO come, a cauda anda junto (o último segmento libera a célula
  // no mesmo instante) — por isso ela precisa ser excluída da checagem de
  // colisão, senão a cobra "morre" ao encostar no próprio rabo em movimento.
  const bodyToCheck = eating ? state.snake : state.snake.slice(0, -1);
  const hitSelf = bodyToCheck.some(
    (seg) => seg.x === newHead.x && seg.y === newHead.y,
  );

  if (hitSelf) {
    return { ...state, direction, gameOver: true };
  }

  const newSnake = eating
    ? [newHead, ...state.snake]
    : [newHead, ...state.snake.slice(0, -1)];

  return {
    ...state,
    snake: newSnake,
    direction,
    score: eating ? state.score + 1 : state.score,
    food: eating ? pickFoodCell(newSnake, state.gridSize) : state.food,
  };
}

/** Velocidade progressiva: acelera com a pontuação, com piso de segurança. */
export function tickDurationForScore(score: number): number {
  return Math.max(70, 150 - score * 3);
}
