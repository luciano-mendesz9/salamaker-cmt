export const LUDO_CHAT_MESSAGES = {
  good_move: "Boa jogada! 🤖",
  your_turn: "É sua vez! ⏱️",
  start: "Vamos começar? 🚀",
  pause: "Podemos continuar mais tarde? 🛠️",
  leaving: "Preciso sair. 😢",
  congrats: "Parabéns! 🏆",
  angry: "Grrr! 😡",
  sad: "Oh, não! 😢",
  afraid: "Socorro! 😨",
  happy: "Muito bem! 😄",
} as const;

export type LudoChatKey = keyof typeof LUDO_CHAT_MESSAGES;
