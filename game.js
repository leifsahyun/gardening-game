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
  const AWARD_CARDS = [
    { id: 'participation', name: 'Participation Certificate', vp: 1, cost: 5 },
    { id: 'merit', name: 'Merit Award', vp: 3, cost: 10 },
    { id: 'blueRibbon', name: 'Blue Ribbon', vp: 6, cost: 15 },
  ];

  // ── Card types ───────────────────────────────────────────────────────────

  /**
   * Defines scoring behaviour and display description for each card type.
   * coinValue   – base coins awarded per card when it is the top card of a deck.
   * scoreBonus  – optional function called once per visible card type; receives
   *               (count, garden) where count is the number of this type visible
   *               and garden is a 3×2 array of card-type strings (garden[row][col],
   *               null for an empty deck). Returns additional coins beyond coinValue.
   * description – text shown on the card face below the card name.
   */
  const CARD_TYPES = {
    potato: {
      description: '1 coin, pair: +2 coins',
      coinValue: 1,
      scoreBonus: (count, garden) =>
        [0, 1, 2].reduce((sum, col) => {
          const inCol = garden.filter((row) => row[col] === 'potato').length;
          return sum + (inCol >= 2 ? 2 : 0);
        }, 0),
    },
    carrot: {
      description: '1 coin, three in a row: +6 coins',
      coinValue: 1,
      scoreBonus: (count, garden) =>
        garden.reduce((sum, row) => {
          const inRow = row.filter((c) => c === 'carrot').length;
          return sum + (inRow === 3 ? 6 : 0);
        }, 0),
    },
    cabbage: {
      description: '3 coins',
      coinValue: 3,
    },
    horseradish: {
      description: '2 coins, +1 coin for each potato in garden',
      coinValue: 2,
      scoreBonus: (count, garden) =>
        count * garden.flat().filter((c) => c === 'potato').length,
    },
    greenbeans: {
      displayName: 'green beans',
      description: '2 coins, pair: +1 coin',
      coinValue: 2,
      scoreBonus: (count, garden) =>
        [0, 1, 2].reduce((sum, col) => {
          const inCol = garden.filter((row) => row[col] === 'greenbeans').length;
          return sum + (inCol >= 2 ? 1 : 0);
        }, 0),
    },
    pumpkin: {
      description: '5 coins if exactly one in your garden',
      coinValue: 0,
      scoreBonus: (count) => (count === 1 ? 5 : 0),
    },
    radish: {
      description: '1 coin, +3 coins if three different vegetables in same row',
      coinValue: 1,
      scoreBonus: (count, garden) =>
        garden.reduce((sum, row) => {
          const hasRadish = row.includes('radish');
          const threeDifferentVegetables = row.every((c) => CARD_TYPES[c])
            && new Set(row).size === 3;
          return sum + (hasRadish && threeDifferentVegetables ? 3 : 0);
        }, 0),
    },
    beet: {
      description: '2 coins, three in a row: +1 coin',
      coinValue: 2,
      scoreBonus: (count, garden) =>
        garden.reduce((sum, row) => {
          const inRow = row.filter((c) => c === 'beet').length;
          return sum + (inRow === 3 ? 1 : 0);
        }, 0),
    },
    strawberry: {
      description: 'Effect: copy an adjacent vegetable',
      coinValue: 0,
      effect: (sourceDeckId) => {
        const sourceIndex = sourceDeckId - 1;
        return {
          label: 'Select an adjacent vegetable to copy',
          filter: (deckId) => {
            const targetIndex = deckId - 1;
            const adjacents = getAdjacentDeckIndices(sourceIndex);
            const topCard = state.decks[targetIndex]?.cards[0];
            return adjacents.includes(targetIndex) && !!topCard && !!CARD_TYPES[topCard] && topCard !== 'strawberry';
          },
          count: 1,
          onComplete: (selectedIds, { addPendingDeck }) => {
            const targetDeck = state.decks.find((d) => d.id === selectedIds[0]);
            const copiedType = targetDeck?.cards[0];
            if (!copiedType || !CARD_TYPES[copiedType]) return;
            state.effects.strawberryReverts.push({ deckId: sourceDeckId, originalCard: 'strawberry' });
            state.decks[sourceIndex].cards[0] = copiedType;
            if (CARD_TYPES[copiedType]?.effect) {
              addPendingDeck(sourceDeckId);
            }
            renderDecks();
          },
        };
      },
    },
    ghostpepper: {
      displayName: 'ghost pepper',
      description: 'Effect: compost the top card of any plot',
      coinValue: 0,
      effect: (sourceDeckId) => ({
        label: 'Select a plot to compost its top card',
        filter: (deckId) => (state.decks.find((d) => d.id === deckId)?.cards.length ?? 0) > 0,
        count: 1,
        onComplete: (selectedIds) => {
          const deck = state.decks.find((d) => d.id === selectedIds[0]);
          if (deck && deck.cards.length > 0) {
            deck.cards.shift();
          }
          renderDecks();
        },
      }),
    },
    eggplant: {
      description: 'Effect: get a random card and bury it in any plot',
      coinValue: 0,
      effect: (sourceDeckId) => {
        const randomCard = getRandomElement(PURCHASE_CARD_POOL, 'dirt');
        return {
          label: `Bury a ${getCardLabel(randomCard)} in any plot`,
          count: 1,
          onComplete: (selectedIds) => {
            const deck = state.decks.find((d) => d.id === selectedIds[0]);
            if (deck) deck.cards.push(randomCard);
            renderDecks();
          },
        };
      },
    },
    garlic: {
      description: 'Effect: till two plots',
      coinValue: 0,
      effect: (sourceDeckId) => ({
        label: 'Select two plots to till',
        filter: (deckId) => {
          const deck = state.decks.find((d) => d.id === deckId);
          return (deck?.cards.length ?? 0) > 0
            && !(state.effects.targeting?.selected ?? []).includes(deckId);
        },
        count: 2,
        onComplete: (selectedIds, { addPendingDeck }) => {
          selectedIds.forEach((deckId) => {
            const deck = state.decks.find((d) => d.id === deckId);
            if (deck && deck.cards.length > 0) {
              deck.cards.push(deck.cards.shift());
              const newTop = deck.cards[0];
              if (newTop && CARD_TYPES[newTop]?.effect) {
                addPendingDeck(deckId);
              }
            }
          });
          renderDecks();
        },
      }),
    },
    zucchini: {
      description: 'Effect: shuffle any number of plots',
      coinValue: 0,
      effect: (sourceDeckId) => ({
        label: 'Select plots to shuffle, then click Confirm',
        filter: (deckId) => {
          const deck = state.decks.find((d) => d.id === deckId);
          return (deck?.cards.length ?? 0) > 0;
        },
        minCount: 0,
        maxCount: Infinity,
        confirmable: true,
        onComplete: (selectedIds, { addPendingDeck }) => {
          selectedIds.forEach((deckId) => {
            const deck = state.decks.find((d) => d.id === deckId);
            if (deck && deck.cards.length > 0) {
              shuffle(deck.cards);
              const newTop = deck.cards[0];
              if (newTop && CARD_TYPES[newTop]?.effect) {
                addPendingDeck(deckId);
              }
            }
          });
          renderDecks();
        },
      }),
    },
  };
  const PURCHASE_CARD_POOL = Object.freeze([...Object.keys(CARD_TYPES)]);

  /** The six decks form a 3-column × 2-row grid; each entry lists deck indices in a row. */
  const GRID_ROWS = [[0, 1, 2], [3, 4, 5]];

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
      { id: 1, cards: ['dirt', 'dirt', 'dirt', 'potato'] },
      { id: 2, cards: ['dirt', 'dirt', 'dirt', 'potato'] },
      { id: 3, cards: ['dirt', 'dirt', 'dirt', 'potato'] },
      { id: 4, cards: ['dirt', 'dirt', 'dirt', 'potato'] },
      { id: 5, cards: ['dirt', 'dirt', 'dirt', 'potato'] },
      { id: 6, cards: ['dirt', 'dirt', 'dirt', 'potato'] },
    ],
    /** Cards currently available for the active player to choose from. */
    selectionArea: [],
    turnNumber: 1,
    phaseIndex: 0,
    purchase: {
      availablePacks: [],
      remainingPlayersAfterHuman: [],
      awaitingHumanSelection: false,
      humanPackCards: [],
    },
    effects: {
      /** Deck ids (1-based) whose top card has an unresolved effect this turn. */
      pendingDecks: [],
      /** Deck id whose effect is currently being resolved (targeting in progress). */
      activeDeckId: null,
      /** Targeting sub-state while waiting for the player to pick decks. */
      targeting: null,
      /** Cards temporarily replaced by a strawberry copy; reverted at end of turn. */
      strawberryReverts: [],
    },
    awardPurchase: {
      purchased: [],
    },
    phases: [
      { id: 'tilling', onEnter: enterTillingPhase },
      { id: 'effects', onEnter: enterEffectsPhase },
      { id: 'scoring', onEnter: enterScoringPhase },
      { id: 'awardPurchase', onEnter: enterAwardPurchasePhase },
      { id: 'purchase', onEnter: enterPurchasePhase },
      { id: 'endTurn', onEnter: enterEndTurnPhase },
    ]
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

  function getCardLabel(cardType) {
    return CARD_TYPES[cardType]?.displayName ?? cardType;
  }

  /**
   * Return the deck indices (0-based) that are adjacent (share an edge) to the given index
   * in the 3-column × 2-row grid.
   */
  function getAdjacentDeckIndices(deckIndex) {
    const row = Math.floor(deckIndex / 3);
    const col = deckIndex % 3;
    const adjacents = [];
    if (col > 0) adjacents.push(row * 3 + col - 1);
    if (col < 2) adjacents.push(row * 3 + col + 1);
    if (row > 0) adjacents.push((row - 1) * 3 + col);
    if (row < 1) adjacents.push((row + 1) * 3 + col);
    return adjacents;
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  /** Update every player's score display in the header. */
  function renderScores() {
    state.players.forEach((player) => {
      const el = document.getElementById(`score-p${player.id}`);
      if (el) {
        const valueEl = el.querySelector('.score-value');
        if (valueEl) {
          valueEl.textContent = player.coins;
        } else {
          const iconEl = document.createElement('span');
          iconEl.setAttribute('aria-hidden', 'true');
          iconEl.textContent = '🪙 ';
          const createdValueEl = document.createElement('span');
          createdValueEl.className = 'score-value';
          createdValueEl.textContent = player.coins;
          el.replaceChildren(iconEl, createdValueEl);
        }
      }
    });
  }

  /** Re-render the card selection area. */
  function renderSelectionArea() {
    const section = document.getElementById('selection-area');
    if (!section) return;

    section.innerHTML = '';

    if (getCurrentPhaseId() === 'awardPurchase') {
      renderAwardPurchaseSelectionArea(section);
      return;
    }

    if (getCurrentPhaseId() === 'purchase') {
      renderPurchaseSelectionArea(section);
      return;
    }

    if (getCurrentPhaseId() === 'effects') {
      renderEffectsSelectionArea(section);
      return;
    }

    if (state.selectionArea.length > 0) {
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

  function renderEffectsSelectionArea(section) {
    const { targeting, pendingDecks } = state.effects;

    if (targeting) {
      const labelEl = document.createElement('p');
      labelEl.className = 'effects-label';
      labelEl.textContent = targeting.label;
      section.appendChild(labelEl);

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'confirm-btn';
      confirmBtn.textContent = 'Done';
      confirmBtn.addEventListener('click', () => {
        completeTargeting();
      });
      section.appendChild(confirmBtn);
      
      return;
    }

    if (pendingDecks.length > 0) {
      const labelEl = document.createElement('p');
      labelEl.className = 'effects-label';
      labelEl.textContent = 'Click a highlighted plot to use its effect.';
      section.appendChild(labelEl);
    }
  }

  function renderPurchaseSelectionArea(section) {
    if (state.purchase.humanPackCards.length > 0) {
      state.purchase.humanPackCards.forEach((card) => {
        const cardEl = createCardElement(card, { draggable: true });
        section.appendChild(cardEl);
      });

      const reminderEl = document.createElement('p');
      reminderEl.className = 'plant-reminder-text';
      reminderEl.textContent = 'Drag cards to plots to plant them';
      section.appendChild(reminderEl);
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
      topText.textContent = getCardLabel(pack.cards[0]);

      const sizeText = document.createElement('div');
      sizeText.className = 'purchase-pack-size';
      sizeText.textContent = `${pack.cards.length} cards`;

      packEl.appendChild(topText);
      packEl.appendChild(sizeText);
      packEl.addEventListener('click', () => onPurchasePackClick(pack.id));
      section.appendChild(packEl);
    });
  }

  /** Update each deck face to show the top card name and its description (if any). */
  function renderDecks() {
    const isEffectsPhase = getCurrentPhaseId() === 'effects';
    const { pendingDecks, activeDeckId, targeting } = state.effects;

    state.decks.forEach((deck) => {
      const deckEl = document.getElementById(`deck-${deck.id}`);
      if (!deckEl) return;

      // Update effects-phase CSS classes.
      deckEl.classList.toggle('deck--highlighted', isEffectsPhase && pendingDecks.includes(deck.id));
      deckEl.classList.toggle('deck--active-effect', isEffectsPhase && activeDeckId === deck.id);
      deckEl.classList.toggle(
        'deck--targetable',
        isEffectsPhase && !!targeting && (!targeting.filter || targeting.filter(deck.id)),
      );
      deckEl.classList.toggle(
        'deck--selected-target',
        isEffectsPhase && !!targeting && targeting.selected.includes(deck.id),
      );

      const face = deckEl.querySelector('.deck-face');
      const label = deckEl.querySelector('.deck-label');
      if (label) {
        const cardCount = deck.cards.length;
        const cardWord = cardCount === 1 ? 'card' : 'cards';
        label.textContent = `Deck ${deck.id} (${cardCount} ${cardWord})`;
      }
      if (!face) return;
      if (deck.cards.length === 0) {
        face.textContent = '';
        return;
      }
      const topCard = deck.cards[0];
      const cardType = CARD_TYPES[topCard];
      if (cardType) {
        face.textContent = '';
        const nameEl = document.createElement('div');
        nameEl.className = 'card-name';
        nameEl.textContent = getCardLabel(topCard);
        const descEl = document.createElement('small');
        descEl.textContent = cardType.description;
        face.appendChild(nameEl);
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

    const cardType = CARD_TYPES[card.cardType];
    if (cardType) {
      const nameEl = document.createElement('div');
      nameEl.className = 'card-name';
      nameEl.textContent = card.text ?? getCardLabel(card.cardType);
      const descEl = document.createElement('small');
      descEl.textContent = cardType.description;
      el.appendChild(nameEl);
      el.appendChild(descEl);
    } else {
      el.textContent = card.text ?? '';
    }
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

  function getHumanPlayer() {
    return state.players.find((player) => !player.isAi) ?? null;
  }

  function countTypes(cards) {
    const typeCounts = {};
    cards.forEach((card) => {
      typeCounts[card] = (typeCounts[card] ?? 0) + 1;
    });
    return typeCounts;
  }

  /**
   * Build the garden passed to each card type's scoreBonus function.
   * Returns a 3×2 array of card-type strings: garden[row][col].
   * Decks with no cards produce a null entry.
   */
  function buildGarden() {
    return GRID_ROWS.map((row) => row.map((i) => state.decks[i]?.cards[0] ?? null));
  }

  /** Sum coins earned across all top cards this scoring phase. */
  function countTotalCoins() {
    const garden = buildGarden();
    const allCards = garden.flat().filter((c) => c && CARD_TYPES[c]);
    const typeCounts = countTypes(allCards);

    let total = allCards.reduce((sum, card) => sum + CARD_TYPES[card].coinValue, 0);

    Object.entries(typeCounts).forEach(([type, count]) => {
      const cardType = CARD_TYPES[type];
      if (cardType?.scoreBonus) {
        total += cardType.scoreBonus(count, garden);
      }
    });

    return total;
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
    renderDecks();
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

  function deckHasPendingEffect(deck) {
    const topCard = deck?.cards[0];
    return !!(topCard && CARD_TYPES[topCard]?.effect);
  }

  function getPendingEffectDeckIds() {
    return state.decks
      .filter((deck) => deckHasPendingEffect(deck))
      .map((deck) => deck.id);
  }

  function refreshPendingEffects() {
    const pendingEffectDeckIds = new Set(getPendingEffectDeckIds());
    state.effects.pendingDecks = state.effects.pendingDecks
      .filter((deckId) => pendingEffectDeckIds.has(deckId));
  }

  function enterTillingPhase() {
    // Wait for player action via the till button.
  }

  function enterEffectsPhase() {
    state.effects.pendingDecks = getPendingEffectDeckIds();
    state.effects.activeDeckId = null;
    state.effects.targeting = null;

    if (state.effects.pendingDecks.length === 0) {
      advancePhase();
      return;
    }

    renderDecks();
    renderSelectionArea();
  }

  function enterScoringPhase() {
    const player = getHumanPlayer();
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

  function enterAwardPurchasePhase() {
    // UI is rendered by renderSelectionArea.
  }

  function renderAwardPurchaseSelectionArea(section) {
    const humanPlayer = getHumanPlayer();

    AWARD_CARDS.forEach((award) => {
      const btn = document.createElement('button');
      btn.className = 'award-card-btn';
      btn.type = 'button';

      const canAfford = humanPlayer && humanPlayer.coins >= award.cost;
      if (!canAfford) btn.disabled = true;

      const nameEl = document.createElement('div');
      nameEl.className = 'award-card-name';
      nameEl.textContent = award.name;

      const vpEl = document.createElement('div');
      vpEl.className = 'award-card-vp';
      vpEl.textContent = `${award.vp} VP`;

      const costEl = document.createElement('div');
      costEl.className = 'award-card-cost';
      costEl.textContent = `Cost: ${award.cost} coins`;

      btn.appendChild(nameEl);
      btn.appendChild(vpEl);
      btn.appendChild(costEl);
      btn.addEventListener('click', () => onAwardCardClick(award.id));
      section.appendChild(btn);
    });

    const footer = document.createElement('div');
    footer.className = 'award-phase-footer';

    const reminderText = document.createElement('p');
    reminderText.className = 'award-reminder-text';
    reminderText.textContent = 'Players with the most remaining coins will select seed packs first';

    const doneBtn = document.createElement('button');
    doneBtn.className = 'award-done-btn';
    doneBtn.type = 'button';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', advancePhase);

    footer.appendChild(reminderText);
    footer.appendChild(doneBtn);
    section.appendChild(footer);
  }

  function onAwardCardClick(awardId) {
    if (getCurrentPhaseId() !== 'awardPurchase') return;
    const award = AWARD_CARDS.find((a) => a.id === awardId);
    if (!award) return;
    const humanPlayer = getHumanPlayer();
    if (!humanPlayer || humanPlayer.coins < award.cost) return;

    humanPlayer.coins -= award.cost;
    state.awardPurchase.purchased.push({ ...award });
    renderScores();
    renderAwardsColumn();
    renderSelectionArea();
  }

  function renderAwardsColumn() {
    const col = document.getElementById('awards-column');
    if (!col) return;
    col.innerHTML = '';

    state.awardPurchase.purchased.forEach((award) => {
      const card = document.createElement('div');
      card.className = 'award-column-card';

      const nameEl = document.createElement('div');
      nameEl.className = 'award-column-card-name';
      nameEl.textContent = award.name;

      const vpEl = document.createElement('div');
      vpEl.className = 'award-column-card-vp';
      vpEl.textContent = `${award.vp} VP`;

      card.appendChild(nameEl);
      card.appendChild(vpEl);
      col.appendChild(card);
    });
  }

  function createPurchasePacks() {
    return PURCHASE_PACK_SIZES.map((size, packIndex) => ({
      id: `turn-${state.turnNumber}-pack-${packIndex + 1}`,
      cards: Array.from({ length: size }, () => getRandomElement(PURCHASE_CARD_POOL, 'dirt')),
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
      takeLargestPack();
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
      takeLargestPack();
    }
    state.purchase.remainingPlayersAfterHuman = [];
    state.purchase.availablePacks = [];
    state.purchase.humanPackCards = selectedPack.cards.map((cardType, index) => ({
      id: `${selectedPack.id}-card-${index}`,
      cardType,
      text: getCardLabel(cardType),
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

    deck.cards.push(card.cardType);
    renderDecks();

    if (state.purchase.humanPackCards.length === 0) {
      advancePhase();
      return;
    }

    renderSelectionArea();
  }

  function enterEndTurnPhase() {
    // Revert any temporary strawberry copies before scoring next turn.
    state.effects.strawberryReverts.forEach(({ deckId, originalCard }) => {
      const deck = state.decks.find((d) => d.id === deckId);
      if (deck && deck.cards.length > 0) {
        deck.cards[0] = originalCard;
      }
    });
    state.effects.strawberryReverts = [];

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

  /** Finish the current targeting interaction and execute the effect's onComplete. */
  function completeTargeting() {
    const { targeting } = state.effects;
    if (!targeting) return;

    const addPendingDeck = (deckId) => {
      if (!state.effects.pendingDecks.includes(deckId)) {
        state.effects.pendingDecks.push(deckId);
      }
    };

    targeting.onComplete(targeting.selected, { addPendingDeck });
    state.effects.targeting = null;
    state.effects.activeDeckId = null;
    refreshPendingEffects();

    if (state.effects.pendingDecks.length === 0) {
      advancePhase();
    } else {
      renderDecks();
      renderSelectionArea();
    }
  }

  /** Handle a deck click during the effects phase. */
  function onEffectsDeckClick(deckId) {
    const { pendingDecks, targeting } = state.effects;

    if (targeting) {
      const isValid = !targeting.filter || targeting.filter(deckId);
      if (!isValid) return;

      // For confirmable multi-select, toggle selection; for exact-count, only add.
      if (targeting.confirmable) {
        if (targeting.selected.includes(deckId)) {
          targeting.selected = targeting.selected.filter((id) => id !== deckId);
        } else {
          targeting.selected.push(deckId);
        }
      } else {
        if (!targeting.selected.includes(deckId)) {
          targeting.selected.push(deckId);
        }
      }

      // Auto-complete when the exact required count is reached.
      const exactCount = targeting.count;
      if (exactCount !== undefined && targeting.selected.length >= exactCount) {
        completeTargeting();
        return;
      }

      renderDecks();
      renderSelectionArea();
      return;
    }

    // No active targeting – start an effect if the clicked deck is pending.
    if (!pendingDecks.includes(deckId)) return;
    const deck = state.decks.find((d) => d.id === deckId);
    const topCard = deck?.cards[0];
    const cardType = CARD_TYPES[topCard];
    if (!cardType?.effect) return;

    const descriptor = cardType.effect(deckId);
    state.effects.activeDeckId = deckId;
    state.effects.pendingDecks = pendingDecks.filter((id) => id !== deckId);
    state.effects.targeting = {
      label: descriptor.label ?? 'Select a target',
      filter: descriptor.filter ?? null,
      count: descriptor.count,
      minCount: descriptor.minCount ?? descriptor.count ?? 1,
      maxCount: descriptor.maxCount ?? descriptor.count ?? 1,
      confirmable: descriptor.confirmable ?? false,
      selected: [],
      onComplete: descriptor.onComplete,
    };

    renderDecks();
    renderSelectionArea();
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
   * @param {number} deckId
   */
  function onDeckClick(deckId) {
    if (getCurrentPhaseId() === 'effects') {
      onEffectsDeckClick(deckId);
      return;
    }
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
