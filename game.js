/**
 * Gardening Game – boilerplate
 *
 * Game state and UI wiring will be defined here as the game is developed.
 * Card content is intentionally left to be defined later.
 */

const Game = (() => {
  const SCORE_ANIMATION_DURATION_MS = 500;

  // ── State ────────────────────────────────────────────────────────────────

  const state = {
    players: [
      { id: 1, name: 'Player 1', coins: 0 },
      { id: 2, name: 'Player 2', coins: 0 },
      { id: 3, name: 'Player 3', coins: 0 },
      { id: 4, name: 'Player 4', coins: 0 },
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
    activePlayerId: 1,
    turnNumber: 1,
    phaseIndex: 0,
    phases: [
      { id: 'tilling', onEnter: enterTillingPhase },
      { id: 'scoring', onEnter: enterScoringPhase },
      { id: 'endTurn', onEnter: enterEndTurnPhase },
    ],
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
      if (el) el.textContent = player.coins;
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

    if (getCurrentPhaseId() === 'tilling') {
      const tillBtn = document.createElement('button');
      tillBtn.className = 'till-btn';
      tillBtn.textContent = 'Till';
      tillBtn.addEventListener('click', till);
      section.appendChild(tillBtn);
    }
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

  function getCurrentPhase() {
    return state.phases[state.phaseIndex] ?? null;
  }

  function getCurrentPhaseId() {
    return getCurrentPhase()?.id ?? '';
  }

  function getActivePlayer() {
    return state.players.find((player) => player.id === state.activePlayerId) ?? null;
  }

  function countTopDeckPotatoes() {
    return state.decks.reduce((count, deck) => count + (isPotatoTopCard(deck) ? 1 : 0), 0);
  }

  function isPotatoTopCard(deck) {
    return deck.cards.length > 0 && deck.cards[0] === 'potato';
  }

  function advanceActivePlayer() {
    const currentIndex = state.players.findIndex((player) => player.id === state.activePlayerId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.players.length;
    state.activePlayerId = state.players[nextIndex].id;
  }

  function animatePlayerCoins(player, targetCoins, onComplete) {
    const startCoins = player.coins;
    if (targetCoins <= startCoins) {
      player.coins = targetCoins;
      renderScores();
      if (onComplete) onComplete();
      return;
    }

    const startTime = performance.now();

    const step = (timestamp) => {
      const progress = Math.min((timestamp - startTime) / SCORE_ANIMATION_DURATION_MS, 1);
      player.coins = startCoins + Math.floor((targetCoins - startCoins) * progress);
      renderScores();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        player.coins = targetCoins;
        renderScores();
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(step);
  }

  function runCurrentPhase() {
    renderSelectionArea();
    const phase = getCurrentPhase();
    if (!phase) return;
    phase.onEnter();
  }

  function advancePhase() {
    state.phaseIndex += 1;
    runCurrentPhase();
  }

  function startTurn() {
    state.phaseIndex = 0;
    runCurrentPhase();
  }

  function enterTillingPhase() {
    // Wait for player action in the till button.
  }

  function enterScoringPhase() {
    const player = getActivePlayer();
    if (!player) {
      advancePhase();
      return;
    }

    const earnedCoins = countTopDeckPotatoes();
    animatePlayerCoins(player, earnedCoins, advancePhase);
  }

  function enterEndTurnPhase() {
    const player = getActivePlayer();
    if (player) {
      player.coins = 0;
      renderScores();
    }

    state.turnNumber += 1;
    startTurn();
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Move the top card of each deck to its bottom, then re-render decks. */
  function tillDecks() {
    state.decks.forEach((deck) => {
      if (deck.cards.length > 0) {
        deck.cards.push(deck.cards.shift());
      }
    });
    renderDecks();
  }

  function till() {
    if (getCurrentPhaseId() !== 'tilling') return;
    tillDecks();
    advancePhase();
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
    renderDecks();
    bindDeckClicks();
    startTurn();
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
