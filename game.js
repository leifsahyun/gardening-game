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
      { id: 1, cards: [] },
      { id: 2, cards: [] },
      { id: 3, cards: [] },
      { id: 4, cards: [] },
      { id: 5, cards: [] },
      { id: 6, cards: [] },
    ],
    /** Cards currently available for the active player to choose from. */
    selectionArea: [],
  };

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
      return;
    }

    state.selectionArea.forEach((card) => {
      const cardEl = createCardElement(card);
      section.appendChild(cardEl);
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
    renderScores();
    renderSelectionArea();
    bindDeckClicks();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    init,
    state,
    renderScores,
    renderSelectionArea,
  };
})();

document.addEventListener('DOMContentLoaded', Game.init);
