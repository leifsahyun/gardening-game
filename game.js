/**
 * Gardening Game – boilerplate
 *
 * Game state and UI wiring will be defined here as the game is developed.
 * Card content is intentionally left to be defined later.
 */

const Game = (() => {
  const SCORE_ANIMATION_DURATION_MS = 500;
  const MIN_AI_COINS = 1;
  const MAX_AI_COINS = 12;
  const PURCHASE_PACK_SIZES = [4, 3, 3, 2];

  // ── Card types ───────────────────────────────────────────────────────────

  /**
   * Defines scoring behaviour and display description for each card type.
   * coinValue  – coins awarded per card when it is the top card of a deck.
   * pairBonus  – extra coins awarded when 2+ cards of this type appear as top
   *              cards in the same grid column.
   * description – text shown on the card face below the card name.
   */
  const CARD_TYPES = {
    potato: {
      description: '1 coin, pair: +2 coins',
      coinValue: 1,
      pairBonus: 2,
    },
  };

  /**
   * The six decks form a 3-column × 2-row grid.
   * Each entry lists the indices (into state.decks) that share a column.
   */
  const GRID_COLUMNS = [[0, 3], [1, 4], [2, 5]];

  // ── State ────────────────────────────────────────────────────────────────

  const state = {
    players: [
      { id: 1, name: 'Player 1', coins: 0, isAi: false },
      { id: 2, name: 'Player 2', coins: 0, isAi: true },
      { id: 3, name: 'Player 3', coins: 0, isAi: true },
      { id: 4, name: 'Player 4', coins: 0, isAi: true },
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
    purchase: {
      availablePacks: [],
      aiChosenPacks: [],
      remainingPlayersAfterHuman: [],
      awaitingHumanSelection: false,
      humanPackCards: [],
    },
    phases: [
      { id: 'tilling', onEnter: enterTillingPhase },
      { id: 'scoring', onEnter: enterScoringPhase },
      { id: 'purchase', onEnter: enterPurchasePhase },
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

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getRandomElement(array, fallback = '') {
    if (array.length === 0) return fallback;
    return array[randomInt(0, array.length - 1)];
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

    if (getCurrentPhaseId() === 'purchase') {
      renderPurchaseSelectionArea(section);
      return;
    }

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

    function renderPurchaseSelectionArea(section) {
      if (state.purchase.humanPackCards.length > 0) {
        state.purchase.humanPackCards.forEach((card) => {
          const cardEl = createCardElement(card, { draggable: true });
          section.appendChild(cardEl);
        });
        return;
      }

      if (state.purchase.availablePacks.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.className = 'placeholder-text';
        placeholder.textContent = 'No packs available';
        section.appendChild(placeholder);
        return;
      }

      state.purchase.availablePacks.forEach((pack) => {
        const packEl = document.createElement('button');
        packEl.className = 'purchase-pack';
        packEl.type = 'button';
        packEl.dataset.packId = pack.id;
        if (!state.purchase.awaitingHumanSelection) packEl.disabled = true;

        const topText = document.createElement('div');
        topText.className = 'purchase-pack-top-card';
        topText.textContent = pack.cards[0];

        const sizeText = document.createElement('div');
        sizeText.className = 'purchase-pack-size';
        sizeText.textContent = `${pack.cards.length} cards`;

        packEl.appendChild(topText);
        packEl.appendChild(sizeText);
        packEl.addEventListener('click', () => onPurchasePackClick(pack.id));
        section.appendChild(packEl);
      });
    }
  }

  /** Update each deck face to show the top card name and its description (if any). */
  function renderDecks() {
    state.decks.forEach((deck) => {
      const deckEl = document.getElementById(`deck-${deck.id}`);
      if (!deckEl) return;
      const face = deckEl.querySelector('.deck-face');
      if (!face) return;
      if (deck.cards.length === 0) {
        face.textContent = '';
        return;
      }
      const topCard = deck.cards[0];
      const cardType = CARD_TYPES[topCard];
      if (cardType) {
        face.textContent = '';
        const nameNode = document.createTextNode(topCard);
        const descEl = document.createElement('small');
        descEl.textContent = cardType.description;
        face.appendChild(nameNode);
        face.appendChild(document.createElement('br'));
        face.appendChild(descEl);
      } else {
        face.textContent = topCard;
      }
    });
  }

  /**
   * Build a card DOM element.
   * @param {{ id: string|number, text?: string }} card
   * @returns {HTMLElement}
   */
  function createCardElement(card, options = {}) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = card.id;
    el.textContent = card.text ?? '';
    if (options.draggable) {
      el.draggable = true;
      el.addEventListener('dragstart', (event) => {
        if (event.dataTransfer) {
          event.dataTransfer.setData('text/plain', String(card.id));
          event.dataTransfer.effectAllowed = 'move';
        }
      });
    }
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

  /**
   * Score a single grid column.
   * Awards each card's coinValue and a pairBonus when ≥2 of the same card type
   * appear as the top card in that column.
   * @param {number[]} columnDeckIndices – indices into state.decks
   * @returns {number}
   */
  function scoreColumn(columnDeckIndices) {
    const columnDecks = columnDeckIndices
      .map((i) => state.decks[i])
      .filter((deck) => deck?.cards);
    let coins = 0;
    const typeCounts = {};
    columnDecks.forEach((deck) => {
      const topCard = deck.cards[0];
      if (!topCard) return;
      const cardType = CARD_TYPES[topCard];
      if (!cardType) return;
      coins += cardType.coinValue;
      typeCounts[topCard] = (typeCounts[topCard] ?? 0) + 1;
    });
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count >= 2 && CARD_TYPES[type].pairBonus) {
        coins += CARD_TYPES[type].pairBonus;
      }
    });
    return coins;
  }

  /** Sum coins earned across all grid columns this scoring phase. */
  function countTotalCoins() {
    return GRID_COLUMNS.reduce((total, col) => total + scoreColumn(col), 0);
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
    const onScoringComplete = () => {
      state.players.forEach((candidate) => {
        if (candidate.isAi) {
          candidate.coins = randomInt(MIN_AI_COINS, MAX_AI_COINS);
        }
      });
      renderScores();
      advancePhase();
    };

    if (!player) {
      onScoringComplete();
      return;
    }

    const earnedCoins = countTotalCoins();
    animatePlayerCoins(player, earnedCoins, onScoringComplete);
  }

  function createPurchasePacks() {
    const cardPool = ['dirt', ...Object.keys(CARD_TYPES)];
    return PURCHASE_PACK_SIZES.map((size, packIndex) => ({
      id: `turn-${state.turnNumber}-pack-${packIndex + 1}`,
      cards: Array.from({ length: size }, () => getRandomElement(cardPool, 'dirt')),
    }));
  }

  function getPlayersByCoinsDescending() {
    return [...state.players].sort((a, b) => {
      if (b.coins !== a.coins) return b.coins - a.coins;
      // Tie-breaker: lower player id picks first when coin totals are equal.
      return a.id - b.id;
    });
  }

  function takeLargestPack() {
    if (state.purchase.availablePacks.length === 0) return null;
    let largestIndex = 0;
    state.purchase.availablePacks.forEach((pack, index) => {
      if (pack.cards.length > state.purchase.availablePacks[largestIndex].cards.length) {
        largestIndex = index;
      }
    });
    return state.purchase.availablePacks.splice(largestIndex, 1)[0] ?? null;
  }

  function enterPurchasePhase() {
    state.purchase.availablePacks = createPurchasePacks();
    state.purchase.aiChosenPacks = [];
    state.purchase.remainingPlayersAfterHuman = [];
    state.purchase.awaitingHumanSelection = false;
    state.purchase.humanPackCards = [];

    const orderedPlayers = getPlayersByCoinsDescending();
    for (let i = 0; i < orderedPlayers.length; i += 1) {
      const player = orderedPlayers[i];
      if (!player.isAi) {
        state.purchase.awaitingHumanSelection = true;
        state.purchase.remainingPlayersAfterHuman = orderedPlayers.slice(i + 1);
        break;
      }
      const selectedPack = takeLargestPack();
      if (selectedPack) state.purchase.aiChosenPacks.push(selectedPack);
    }

    renderSelectionArea();
  }

  function onPurchasePackClick(packId) {
    if (getCurrentPhaseId() !== 'purchase' || !state.purchase.awaitingHumanSelection) return;
    const packIndex = state.purchase.availablePacks.findIndex((pack) => pack.id === packId);
    if (packIndex === -1) return;

    const [selectedPack] = state.purchase.availablePacks.splice(packIndex, 1);
    if (!selectedPack) return;

    state.purchase.awaitingHumanSelection = false;
    for (let i = 0; i < state.purchase.remainingPlayersAfterHuman.length; i += 1) {
      const aiSelectedPack = takeLargestPack();
      if (aiSelectedPack) state.purchase.aiChosenPacks.push(aiSelectedPack);
    }
    state.purchase.remainingPlayersAfterHuman = [];
    state.purchase.availablePacks = [];
    state.purchase.humanPackCards = selectedPack.cards.map((cardType, index) => ({
      id: `${selectedPack.id}-card-${index}`,
      text: cardType,
    }));
    renderSelectionArea();
  }

  function onDeckDrop(deckId, cardId) {
    if (getCurrentPhaseId() !== 'purchase' || state.purchase.awaitingHumanSelection) return;
    const cardIndex = state.purchase.humanPackCards.findIndex((card) => String(card.id) === cardId);
    if (cardIndex === -1) return;

    const [card] = state.purchase.humanPackCards.splice(cardIndex, 1);
    const deck = state.decks.find((candidate) => candidate.id === deckId);
    if (!deck) return;

    deck.cards.push(card.text);
    renderDecks();

    if (state.purchase.humanPackCards.length === 0) {
      advancePhase();
      return;
    }

    renderSelectionArea();
  }

  function enterEndTurnPhase() {
    state.players.forEach((player) => {
      player.coins = 0;
    });
    renderScores();

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

  function bindDeckDrops() {
    document.querySelectorAll('.deck').forEach((deckEl) => {
      deckEl.addEventListener('dragover', (event) => {
        if (getCurrentPhaseId() !== 'purchase' || state.purchase.awaitingHumanSelection) return;
        event.preventDefault();
      });
      deckEl.addEventListener('drop', (event) => {
        if (getCurrentPhaseId() !== 'purchase' || state.purchase.awaitingHumanSelection) return;
        event.preventDefault();
        const cardId = event.dataTransfer?.getData('text/plain');
        if (!deckEl.dataset.deck || !cardId) return;
        const deckId = parseInt(deckEl.dataset.deck, 10);
        if (Number.isNaN(deckId)) return;
        onDeckDrop(deckId, cardId);
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
    bindDeckDrops();
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
