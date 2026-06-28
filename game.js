/**
 * Gardening Game – boilerplate
 *
 * Game state and UI wiring will be defined here as the game is developed.
 * Card content is intentionally left to be defined later.
 */

const Game = (() => {
  // ── State ────────────────────────────────────────────────────────────────

  const state = {
    players: [
      { id: 1, name: 'Player 1', score: 0 },
      { id: 2, name: 'Player 2', score: 0 },
      { id: 3, name: 'Player 3', score: 0 },
      { id: 4, name: 'Player 4', score: 0 },
    ],
    /** Six decks – card contents to be defined later. */
    decks: [
      { id: 1, cards: ['dirt', 'dirt', 'dirt', 'dirt', 'potato'] },
      { id: 2, cards: ['dirt', 'dirt', 'dirt', 'dirt', 'potato'] },
      { id: 3, cards: ['dirt', 'dirt', 'dirt', 'dirt', 'potato'] },
      { id: 4, cards: ['dirt', 'dirt', 'dirt', 'dirt', 'potato'] },
      { id: 5, cards: ['dirt', 'dirt', 'dirt', 'dirt', 'potato'] },
      { id: 6, cards: ['dirt', 'dirt', 'dirt', 'dirt', 'potato'] },
    ],
    /** Cards currently available for the active player to choose from. */
    selectionArea: [],
  };

  // ── Utilities ────────────────────────────────────────────────────────────

  /** Fisher-Yates shuffle (in-place). */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  /** Update every player's score display in the header. */
  function renderScores() {
    state.players.forEach((player) => {
      const el = document.getElementById(`score-p${player.id}`);
      if (el) el.textContent = player.score;
    });
  }

  /** Re-render the card selection area. */
  function renderSelectionArea() {
    const section = document.getElementById('selection-area');
    if (!section) return;

    section.innerHTML = '';

    if (state.selectionArea.length === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'placeholder-text';
      placeholder.textContent = 'Card selection area';
      section.appendChild(placeholder);
    } else {
      state.selectionArea.forEach((card) => {
        const cardEl = createCardElement(card);
        section.appendChild(cardEl);
      });
    }

    const tillBtn = document.createElement('button');
    tillBtn.className = 'till-btn';
    tillBtn.textContent = 'Till';
    tillBtn.addEventListener('click', till);
    section.appendChild(tillBtn);
  }

  /** Update each deck face to show the text of its top card. */
  function renderDecks() {
    state.decks.forEach((deck) => {
      const deckEl = document.getElementById(`deck-${deck.id}`);
      if (!deckEl) return;
      const face = deckEl.querySelector('.deck-face');
      if (!face) return;
      face.textContent = deck.cards.length > 0 ? deck.cards[0] : '';
    });
  }

  /**
   * Build a card DOM element.
   * @param {{ id: string|number, text?: string }} card
   * @returns {HTMLElement}
   */
  function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = card.id;
    el.textContent = card.text ?? '';
    return el;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Move the top card of each deck to its bottom, then re-render decks. */
  function till() {
    state.decks.forEach((deck) => {
      if (deck.cards.length > 0) {
        deck.cards.push(deck.cards.shift());
      }
    });
    renderDecks();
  }

  // ── Event wiring ─────────────────────────────────────────────────────────

  function bindDeckClicks() {
    document.querySelectorAll('.deck').forEach((deckEl) => {
      deckEl.addEventListener('click', () => {
        if (!deckEl.dataset.deck) return;
        const deckId = parseInt(deckEl.dataset.deck, 10);
        if (!Number.isNaN(deckId)) onDeckClick(deckId);
      });
    });
  }

  /**
   * Called when a player clicks a deck.
   * Replace with game logic once card content is defined.
   * @param {number} deckId
   */
  function onDeckClick(deckId) {
    console.log(`Deck ${deckId} clicked`);
  }

  // ── Initialisation ───────────────────────────────────────────────────────

  function init() {
    state.decks.forEach((deck) => shuffle(deck.cards));
    renderScores();
    renderSelectionArea();
    renderDecks();
    bindDeckClicks();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    init,
    state,
    renderScores,
    renderSelectionArea,
    renderDecks,
    till,
  };
})();

document.addEventListener('DOMContentLoaded', Game.init);
