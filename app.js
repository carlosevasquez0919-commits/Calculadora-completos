const APP_CONFIG = {
  defaults: {
    personas: 6,
    completosPorPersona: 2,
    tipo: "italiano",
    paltaMulita: false,
  },
  feedback: {
    invalidInputs: "Ingresa valores enteros mayores a 0 en personas y completos por persona.",
    calculationUpdated: "Calculo actualizado.",
    listCopied: "Lista copiada al portapapeles.",
    copyFailed: "No se pudo copiar la lista automaticamente.",
    formReset: "Valores restablecidos.",
  },
  ingredientOrder: ["salchicha", "pan", "tomate", "palta", "chucrut", "americana", "mayonesa"],
  completoTypes: {
    italiano: {
      label: "Italiano",
      ingredients: ["palta", "tomate", "mayonesa"],
    },
    completo: {
      label: "Completo",
      ingredients: ["palta", "tomate", "chucrut", "mayonesa"],
    },
    dinamico: {
      label: "Dinamico",
      ingredients: ["palta", "tomate", "chucrut", "americana", "mayonesa"],
    },
  },
  ingredients: {
    pan: {
      icon: "🥖",
      label: "Panes",
      kind: "count",
      alwaysIncluded: true,
      amountPerCompleto: 1,
      singular: "pan",
      plural: "panes",
      cardNote: () => "Considera 1 pan por completo.",
      shoppingLine: ({ amount, format }) => format.count(amount, "pan", "panes"),
    },
    salchicha: {
      icon: "🌭",
      label: "Salchichas",
      kind: "count",
      alwaysIncluded: true,
      amountPerCompleto: 1,
      singular: "salchicha",
      plural: "salchichas",
      cardNote: ({ totalCompletos }) => `${totalCompletos} completo${totalCompletos === 1 ? "" : "s"}, una por unidad.`,
      shoppingLine: ({ amount, format }) => format.count(amount, "salchicha", "salchichas"),
    },
    tomate: {
      icon: "🍅",
      label: "Tomates",
      kind: "weight",
      amountPerCompleto: 0.06,
      unitLabel: "kg tomates",
      approxWeight: 0.2,
      approxSingular: "tomate",
      approxPlural: "tomates",
    },
    palta: {
      icon: "🥑",
      label: "Paltas",
      kind: "weight",
      amountPerCompleto: (formValues) => (formValues.paltaMulita ? 0.09 : 0.075),
      unitLabel: "kg paltas",
      approxWeight: 0.18,
      approxSingular: "palta",
      approxPlural: "paltas",
    },
    chucrut: {
      icon: "🥬",
      label: "Chucrut",
      kind: "optional",
      detail: "Incluye chucrut a gusto",
      shoppingText: "Chucrut a gusto",
    },
    americana: {
      icon: "🧅",
      label: "Salsa americana",
      kind: "optional",
      detail: "Incluye salsa americana a gusto",
      shoppingText: "Salsa americana a gusto",
    },
    mayonesa: {
      icon: "🥣",
      label: "Mayonesa",
      kind: "optional",
      detail: "Incluye mayonesa a gusto",
      shoppingText: "Mayonesa a gusto",
    },
  },
};

function getElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`No se encontro el elemento ${selector}`);
  }

  return element;
}

function createDomBindings() {
  return {
    form: getElement("#calculator-form"),
    personasInput: getElement("#personas"),
    completosInput: getElement("#completos"),
    tipoInput: getElement("#tipo"),
    mulitasInput: getElement("#mulitas"),
    resetButton: getElement("#reset-btn"),
    copyButton: getElement("#copy-btn"),
    feedback: getElement("#feedback"),
    resultsTitle: getElement("#results-title"),
    resultsType: getElement("#results-type"),
    cardsContainer: getElement("#result-cards"),
    shoppingListOutput: getElement("#shopping-list-output"),
    shoppingListCount: getElement("#shopping-list-count"),
    cardTemplate: getElement("#result-card-template"),
  };
}

const format = {
  count(value, singular, plural) {
    const rounded = Math.round(value);
    return `${rounded} ${rounded === 1 ? singular : plural}`;
  },

  weight(value, unitLabel) {
    return `${value.toFixed(2)} ${unitLabel}`;
  },

  approximation(value, ingredient) {
    const approxUnits = Math.max(1, Math.round(value / ingredient.approxWeight));
    const label = approxUnits === 1 ? ingredient.approxSingular : ingredient.approxPlural;
    return `~${approxUnits} ${label}`;
  },
};

function parsePositiveInteger(value) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getFormValues(dom) {
  return {
    personas: parsePositiveInteger(dom.personasInput.value),
    completosPorPersona: parsePositiveInteger(dom.completosInput.value),
    tipo: dom.tipoInput.value,
    paltaMulita: dom.mulitasInput.checked,
  };
}

function setFormValues(dom, values) {
  dom.personasInput.value = values.personas;
  dom.completosInput.value = values.completosPorPersona;
  dom.tipoInput.value = values.tipo;
  dom.mulitasInput.checked = values.paltaMulita;
}

function validateFormValues(formValues) {
  const hasValidNumericInputs = Boolean(formValues.personas && formValues.completosPorPersona);
  const hasValidType = Boolean(APP_CONFIG.completoTypes[formValues.tipo]);

  if (!hasValidNumericInputs || !hasValidType) {
    return {
      valid: false,
      message: APP_CONFIG.feedback.invalidInputs,
    };
  }

  return {
    valid: true,
    values: formValues,
  };
}

function resolveIncludedIngredients(formValues) {
  const selectedType = APP_CONFIG.completoTypes[formValues.tipo];
  const selectedIngredients = new Set(selectedType.ingredients);

  return Object.keys(APP_CONFIG.ingredients).reduce((included, ingredientKey) => {
    const ingredient = APP_CONFIG.ingredients[ingredientKey];
    included[ingredientKey] = Boolean(ingredient.alwaysIncluded || selectedIngredients.has(ingredientKey));
    return included;
  }, {});
}

function resolveAmountPerCompleto(ingredient, formValues) {
  if (typeof ingredient.amountPerCompleto === "function") {
    return ingredient.amountPerCompleto(formValues);
  }

  return ingredient.amountPerCompleto ?? 0;
}

function calculateIngredientAmounts(totalCompletos, formValues, includedIngredients) {
  return Object.entries(APP_CONFIG.ingredients).reduce((amounts, [ingredientKey, ingredient]) => {
    if (!includedIngredients[ingredientKey]) {
      amounts[ingredientKey] = 0;
      return amounts;
    }

    if (ingredient.kind === "optional") {
      amounts[ingredientKey] = null;
      return amounts;
    }

    amounts[ingredientKey] = totalCompletos * resolveAmountPerCompleto(ingredient, formValues);
    return amounts;
  }, {});
}

function buildCalculationResult(formValues) {
  const totalCompletos = formValues.personas * formValues.completosPorPersona;
  const includedIngredients = resolveIncludedIngredients(formValues);
  const ingredientAmounts = calculateIngredientAmounts(totalCompletos, formValues, includedIngredients);

  return {
    totalCompletos,
    typeLabel: APP_CONFIG.completoTypes[formValues.tipo].label,
    includedIngredients,
    ingredientAmounts,
  };
}

function buildIngredientDisplayModel(ingredientKey, result) {
  const ingredient = APP_CONFIG.ingredients[ingredientKey];
  const amount = result.ingredientAmounts[ingredientKey];

  if (ingredient.kind === "count") {
    return {
      key: ingredientKey,
      value: format.count(amount, ingredient.singular, ingredient.plural),
      note: ingredient.cardNote({ totalCompletos: result.totalCompletos }),
    };
  }

  if (ingredient.kind === "weight") {
    return {
      key: ingredientKey,
      value: format.weight(amount, ingredient.unitLabel),
      note: format.approximation(amount, ingredient),
    };
  }

  return {
    key: ingredientKey,
    value: "A gusto",
    note: ingredient.detail,
  };
}

function buildResultCards(result) {
  return APP_CONFIG.ingredientOrder
    .filter((ingredientKey) => result.includedIngredients[ingredientKey])
    .map((ingredientKey) => buildIngredientDisplayModel(ingredientKey, result));
}

function buildShoppingListLines(result) {
  const lines = ["Lista de compra:", ""];

  APP_CONFIG.ingredientOrder
    .filter((ingredientKey) => result.includedIngredients[ingredientKey])
    .forEach((ingredientKey) => {
      const ingredient = APP_CONFIG.ingredients[ingredientKey];
      const amount = result.ingredientAmounts[ingredientKey];

      if (ingredient.kind === "count") {
        lines.push(ingredient.shoppingLine({ amount, format }));
        return;
      }

      if (ingredient.kind === "weight") {
        lines.push(`${format.weight(amount, ingredient.unitLabel)} (${format.approximation(amount, ingredient)})`);
        return;
      }

      lines.push(ingredient.shoppingText);
    });

  return lines;
}

function buildShoppingListText(result) {
  return buildShoppingListLines(result).join("\n");
}

function createResultCardElement(dom, cardData, index) {
  const cardElement = dom.cardTemplate.content.firstElementChild.cloneNode(true);
  const ingredient = APP_CONFIG.ingredients[cardData.key];

  cardElement.style.animationDelay = `${index * 40}ms`;
  cardElement.querySelector(".result-icon").textContent = ingredient.icon;
  cardElement.querySelector(".result-name").textContent = ingredient.label;
  cardElement.querySelector(".result-value").textContent = cardData.value;
  cardElement.querySelector(".result-note").textContent = cardData.note;

  return cardElement;
}

function renderCards(dom, cards) {
  dom.cardsContainer.innerHTML = "";

  cards.forEach((card, index) => {
    dom.cardsContainer.appendChild(createResultCardElement(dom, card, index));
  });
}

function renderResults(dom, result) {
  const cards = buildResultCards(result);

  dom.resultsTitle.textContent = `${result.totalCompletos} completo${result.totalCompletos === 1 ? "" : "s"} en total`;
  dom.resultsType.textContent = result.typeLabel;
  dom.shoppingListOutput.textContent = buildShoppingListText(result);
  dom.shoppingListCount.textContent = `${cards.length} item${cards.length === 1 ? "" : "s"} calculados`;

  renderCards(dom, cards);
}

function setFeedback(dom, message = "", tone = "") {
  dom.feedback.textContent = message;
  dom.feedback.className = "feedback";

  if (tone) {
    dom.feedback.classList.add(tone);
  }
}

function shakeInvalidFields(dom, formValues) {
  const fieldsToCheck = [
    { input: dom.personasInput, value: formValues.personas },
    { input: dom.completosInput, value: formValues.completosPorPersona },
  ];

  fieldsToCheck.forEach(({ input, value }) => {
    if (value) {
      return;
    }

    input.classList.remove("shake");
    void input.offsetWidth;
    input.classList.add("shake");
  });
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");

  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";

  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("Fallback copy failed");
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  fallbackCopyText(text);
}

function createApp(dom) {
  function calculateAndRender(options = {}) {
    const formValues = getFormValues(dom);
    const validation = validateFormValues(formValues);

    if (!validation.valid) {
      setFeedback(dom, validation.message, "error");
      shakeInvalidFields(dom, formValues);
      return null;
    }

    const result = buildCalculationResult(validation.values);
    renderResults(dom, result);

    if (options.announceUpdate) {
      setFeedback(dom, APP_CONFIG.feedback.calculationUpdated, "success");
    } else if (dom.feedback.classList.contains("error")) {
      setFeedback(dom);
    }

    return result;
  }

  async function handleCopy() {
    const result = calculateAndRender();

    if (!result) {
      return;
    }

    try {
      await copyTextToClipboard(buildShoppingListText(result));
      setFeedback(dom, APP_CONFIG.feedback.listCopied, "success");
    } catch (error) {
      setFeedback(dom, APP_CONFIG.feedback.copyFailed, "error");
    }
  }

  function handleReset() {
    setFormValues(dom, APP_CONFIG.defaults);
    calculateAndRender();
    setFeedback(dom, APP_CONFIG.feedback.formReset, "success");
  }

  function handleAutoCalculation() {
    calculateAndRender();
  }

  function bindEvents() {
    dom.form.addEventListener("submit", (event) => {
      event.preventDefault();
      calculateAndRender({ announceUpdate: true });
    });

    dom.form.addEventListener("input", handleAutoCalculation);
    dom.form.addEventListener("change", handleAutoCalculation);
    dom.resetButton.addEventListener("click", handleReset);
    dom.copyButton.addEventListener("click", handleCopy);
  }

  function init() {
    setFormValues(dom, APP_CONFIG.defaults);
    bindEvents();
    calculateAndRender();
  }

  return { init };
}

const dom = createDomBindings();
const app = createApp(dom);

app.init();
