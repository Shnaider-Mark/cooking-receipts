import { useEffect, useMemo, useState } from "react";
import {
  createMealPlan,
  createRecipe,
  deleteMealPlan,
  deleteRecipe,
  fetchMealPlans,
  fetchRecipe,
  fetchRecipes,
  fetchShoppingList,
  getImageUrl,
  updateRecipe,
  uploadPhoto
} from "./api";
import type { MealPlanItem, RecipeDetail, RecipeListItem, RecipePayload } from "./types";

type ViewState =
  | { mode: "list" }
  | { mode: "detail"; id: number }
  | { mode: "create" }
  | { mode: "edit"; id: number };

type AppTab = "recipes" | "planner";

const EMPTY_RECIPE: RecipePayload = {
  title: "",
  category: "",
  description: "",
  servings: 1,
  prepTimeMin: 0,
  cookTimeMin: 0,
  photoUrl: null,
  ingredients: [{ section: "Основное", name: "", amount: "100", unit: "г" }],
  steps: [""],
  tags: []
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("recipes");
  const [view, setView] = useState<ViewState>({ mode: "list" });
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestedCategories = ["Десерты", "Рыба", "Говядина", "Курица", "Супы", "Салаты", "Завтраки"];

  const tags = useMemo(
    () => Array.from(new Set(recipes.flatMap((recipe) => recipe.tags))).sort((a, b) => a.localeCompare(b)),
    [recipes]
  );
  const categories = useMemo(
    () =>
      Array.from(new Set([...suggestedCategories, ...recipes.map((recipe) => recipe.category)]))
        .map((item) => item.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [recipes]
  );
  const ingredientGroups = useMemo(() => {
    if (!selectedRecipe) {
      return [] as Array<[string, RecipeDetail["ingredients"]]>;
    }
    return Object.entries(
      selectedRecipe.ingredients.reduce<Record<string, RecipeDetail["ingredients"]>>((acc, ingredient) => {
        const section = ingredient.section || "Основное";
        if (!acc[section]) {
          acc[section] = [];
        }
        acc[section].push(ingredient);
        return acc;
      }, {})
    );
  }, [selectedRecipe]);
  const hasActiveFilters = search.trim().length > 0 || Boolean(activeTag) || Boolean(activeCategory);
  const listSkeletonItems = useMemo(() => Array.from({ length: 6 }, (_, index) => `skeleton-${index}`), []);

  useEffect(() => {
    void loadRecipes();
  }, [search, activeTag, activeCategory]);

  useEffect(() => {
    if (view.mode !== "detail") {
      setSelectedRecipe(null);
      return;
    }
    void loadRecipe(view.id);
  }, [view]);

  async function loadRecipes() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRecipes({ q: search, tag: activeTag, category: activeCategory });
      setRecipes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить рецепты");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecipe(id: number) {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRecipe(id);
      setSelectedRecipe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить рецепт");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteRecipe(id: number) {
    const confirmed = window.confirm("Удалить рецепт?");
    if (!confirmed) {
      return;
    }
    try {
      setLoading(true);
      await deleteRecipe(id);
      await loadRecipes();
      setView({ mode: "list" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить рецепт");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <button
            type="button"
            className="header-title-button"
            onClick={() => setView({ mode: "list" })}
            aria-label="Перейти на главную страницу"
          >
            <h1>Мои рецепты</h1>
          </button>
          <p className="header-subtitle">Домашняя коллекция рецептов</p>
        </div>
        {activeTab === "recipes" && (
          <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "create" })}>
            + Новый рецепт
          </button>
        )}
      </header>
      <div className="tabs-row">
        <button
          type="button"
          className={`tab-button ${activeTab === "recipes" ? "tab-button-active" : ""}`}
          onClick={() => setActiveTab("recipes")}
        >
          Рецепты
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "planner" ? "tab-button-active" : ""}`}
          onClick={() => setActiveTab("planner")}
        >
          План недели
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && view.mode !== "list" && <div className="alert">Загрузка...</div>}

      {activeTab === "recipes" && (
        <>
          {view.mode === "list" && (
            <section className="list-view">
              <div className="toolbar">
                <div className="filters">
                  <input
                    placeholder="Поиск по названию"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select value={activeTag} onChange={(event) => setActiveTag(event.target.value)}>
                    <option value="">Все теги</option>
                    {tags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                  <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}>
                    <option value="">Все категории</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setSearch("");
                      setActiveTag("");
                      setActiveCategory("");
                    }}
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>
              <p className="list-meta">{loading ? "Обновляем список..." : `Найдено рецептов: ${recipes.length}`}</p>
              <div className="card-grid">
                {loading &&
                  listSkeletonItems.map((item) => (
                    <article key={item} className="card recipe-card skeleton-card" aria-hidden="true">
                      <div className="skeleton skeleton-title" />
                      <div className="skeleton skeleton-badge" />
                      <div className="skeleton skeleton-line" />
                      <div className="skeleton skeleton-line short" />
                      <div className="skeleton skeleton-actions" />
                    </article>
                  ))}
                {recipes.length === 0 && !loading && (
                  <article className="card empty-state">
                    <h3>Рецепты не найдены</h3>
                    <p>Попробуйте изменить фильтры или добавьте новый рецепт.</p>
                  </article>
                )}
                {recipes.map((recipe) => (
                  <article key={recipe.id} className="card recipe-card">
                    <div className="recipe-card-head">
                      <h3 title={recipe.title}>{recipe.title}</h3>
                      <span className="category-badge">{recipe.category}</span>
                    </div>
                    <p className="recipe-description">{recipe.description || "Без описания"}</p>
                    {recipe.tags.length > 0 && (
                      <div className="chips">
                        {recipe.tags.map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="actions recipe-actions">
                      <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "detail", id: recipe.id })}>
                        Открыть
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setView({ mode: "edit", id: recipe.id })}>
                        Редактировать
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => void onDeleteRecipe(recipe.id)}>
                        Удалить
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {view.mode === "detail" && selectedRecipe && (
            <section className="detail detail-view">
          <div className="detail-topbar">
            <button type="button" className="btn btn-ghost" onClick={() => setView({ mode: "list" })}>
              ← К списку
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setView({ mode: "edit", id: selectedRecipe.id })}>
              Редактировать
            </button>
          </div>
          <div className="detail-title-block">
            <h2>{selectedRecipe.title}</h2>
            <span className="category-badge">{selectedRecipe.category}</span>
          </div>
          {getImageUrl(selectedRecipe.photoUrl) && (
            <img src={getImageUrl(selectedRecipe.photoUrl) ?? ""} alt={selectedRecipe.title} className="photo" />
          )}
          <p className="detail-description">{selectedRecipe.description || "Без описания"}</p>
          <div className="detail-stats">
            <div className="stat-card">
              <span className="stat-label">
                <span className="stat-icon" aria-hidden="true">
                  🍽
                </span>
                Порций
              </span>
              <strong>{selectedRecipe.servings}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">
                <span className="stat-icon" aria-hidden="true">
                  ⏱
                </span>
                Подготовка
              </span>
              <strong>{selectedRecipe.prepTimeMin} мин</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">
                <span className="stat-icon" aria-hidden="true">
                  🔥
                </span>
                Готовка
              </span>
              <strong>{selectedRecipe.cookTimeMin} мин</strong>
            </div>
          </div>
          <h3>Ингредиенты</h3>
          {ingredientGroups.length === 0 && (
            <div className="detail-section empty-inline">
              <p>🥬 Ингредиенты пока не добавлены.</p>
            </div>
          )}
          {ingredientGroups.map(([section, items]) => (
            <div key={section} className="detail-section">
              <h4>{section}</h4>
              <ul className="ingredient-list">
                {items.map((item, index) => (
                  <li key={`${section}-${item.name}-${index}`}>
                    <span>{item.name}</span>
                    <span>
                      {item.amount} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <h3>Шаги</h3>
          {selectedRecipe.steps.length === 0 ? (
            <div className="detail-section empty-inline">
              <p>📝 Шаги приготовления пока не добавлены.</p>
            </div>
          ) : (
            <ol className="steps-list">
              {selectedRecipe.steps.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          )}
          {selectedRecipe.tags.length > 0 && (
            <>
              <h3>Теги</h3>
              <div className="chips">
                {selectedRecipe.tags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
            </section>
          )}

          {(view.mode === "create" || view.mode === "edit") && (
            <RecipeForm
              recipeId={view.mode === "edit" ? view.id : null}
              onCancel={() => setView({ mode: "list" })}
              onSaved={async (id) => {
                await loadRecipes();
                setView({ mode: "detail", id });
              }}
            />
          )}
        </>
      )}
      {activeTab === "planner" && <MealPlanner />}
    </div>
  );
}

function RecipeForm(props: { recipeId: number | null; onCancel: () => void; onSaved: (id: number) => Promise<void> }) {
  const { recipeId, onCancel, onSaved } = props;
  const [form, setForm] = useState<RecipePayload>(EMPTY_RECIPE);
  const [tagsInput, setTagsInput] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sectionSuggestions = ["Основное", "Соус", "Гарнир", "Украшение"];

  useEffect(() => {
    if (!recipeId) {
      setForm(EMPTY_RECIPE);
      setTagsInput("");
      setNewSectionName("");
      return;
    }
    void (async () => {
      const recipe = await fetchRecipe(recipeId);
      setForm({
        title: recipe.title,
        category: recipe.category,
        description: recipe.description ?? "",
        servings: recipe.servings,
        prepTimeMin: recipe.prepTimeMin,
        cookTimeMin: recipe.cookTimeMin,
        photoUrl: recipe.photoUrl,
        ingredients: recipe.ingredients.length
          ? recipe.ingredients.map((item) => ({
              ...item,
              section: item.section || "Основное"
            }))
          : [{ section: "Основное", name: "", amount: "100", unit: "г" }],
        steps: recipe.steps.length ? recipe.steps : [""],
        tags: recipe.tags
      });
      setTagsInput(recipe.tags.join(", "));
      setNewSectionName("");
    })();
  }, [recipeId]);

  const ingredientSections = useMemo(
    () =>
      Object.entries(
        form.ingredients.reduce<Record<string, Array<{ item: RecipePayload["ingredients"][number]; index: number }>>>(
          (acc, item, index) => {
            const section = (item.section || "Основное").trim() || "Основное";
            if (!acc[section]) {
              acc[section] = [];
            }
            acc[section].push({ item, index });
            return acc;
          },
          {}
        )
      ),
    [form.ingredients]
  );
  const previewTags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsInput]
  );

  function updateIngredient(index: number, field: "name" | "amount" | "unit", value: string) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    }));
  }

  function renameSection(oldSection: string, newValue: string) {
    const newSection = newValue.trim();
    if (!newSection) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item) =>
        ((item.section || "Основное").trim() || "Основное") === oldSection ? { ...item, section: newSection } : item
      )
    }));
  }

  function addIngredientToSection(section: string) {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { section, name: "", amount: "100", unit: "г" }]
    }));
  }

  function removeIngredient(index: number) {
    setForm((prev) => {
      const nextIngredients = prev.ingredients.filter((_, i) => i !== index);
      return {
        ...prev,
        ingredients: nextIngredients.length ? nextIngredients : [{ section: "Основное", name: "", amount: "100", unit: "г" }]
      };
    });
  }

  function addSection() {
    const section = newSectionName.trim();
    if (!section) {
      return;
    }
    addIngredientToSection(section);
    setNewSectionName("");
  }

  function removeSection(section: string) {
    setForm((prev) => {
      const nextIngredients = prev.ingredients.filter(
        (item) => ((item.section || "Основное").trim() || "Основное") !== section
      );
      return {
        ...prev,
        ingredients: nextIngredients.length ? nextIngredients : [{ section: "Основное", name: "", amount: "100", unit: "г" }]
      };
    });
  }

  function updateStep(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? value : step))
    }));
  }

  async function onUploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) {
      return;
    }
    const file = event.target.files[0];
    setMessage("Загружаю фото...");
    try {
      const url = await uploadPhoto(file);
      setForm((prev) => ({ ...prev, photoUrl: url }));
      setMessage("Фото загружено.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить фото");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const payload: RecipePayload = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      ingredients: form.ingredients.map((item) => ({
        ...item,
        section: item.section.trim(),
        name: item.name.trim(),
        amount: item.amount.trim(),
        unit: item.unit.trim()
      })),
      steps: form.steps.map((step) => step.trim()).filter(Boolean),
      tags: tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    };

    try {
      if (recipeId) {
        await updateRecipe(recipeId, payload);
        await onSaved(recipeId);
      } else {
        const created = await createRecipe(payload);
        await onSaved(created.id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form recipe-form" onSubmit={(event) => void submit(event)}>
      <div className="form-header">
        <h2>{recipeId ? "Редактирование рецепта" : "Новый рецепт"}</h2>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
      {message && <div className="alert">{message}</div>}

      <section className="form-section">
        <h3>Основное</h3>
        <label>
          Название
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        </label>

        <label>
          Категория
          <input
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            list="category-suggestions"
            required
          />
          <datalist id="category-suggestions">
            {["Десерты", "Рыба", "Говядина", "Курица", "Супы", "Салаты", "Завтраки"].map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>

        <label>
          Описание
          <textarea
            value={form.description}
            rows={3}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>

        <div className="row stats-row">
          <label>
            Порций
            <input
              type="number"
              min={1}
              value={form.servings}
              onChange={(event) => setForm({ ...form, servings: Number(event.target.value) })}
            />
          </label>
          <label>
            Подготовка (мин)
            <input
              type="number"
              min={0}
              value={form.prepTimeMin}
              onChange={(event) => setForm({ ...form, prepTimeMin: Number(event.target.value) })}
            />
          </label>
          <label>
            Готовка (мин)
            <input
              type="number"
              min={0}
              value={form.cookTimeMin}
              onChange={(event) => setForm({ ...form, cookTimeMin: Number(event.target.value) })}
            />
          </label>
        </div>

        <label>
          Фото
          <input type="file" accept="image/*" onChange={(event) => void onUploadPhoto(event)} />
        </label>
        {getImageUrl(form.photoUrl) ? (
          <img src={getImageUrl(form.photoUrl) ?? ""} alt="Рецепт" className="photo" />
        ) : (
          <div className="photo-placeholder">Изображение не выбрано</div>
        )}
      </section>

      <section className="form-section">
        <h3>Ингредиенты</h3>
        {ingredientSections.map(([section, sectionItems]) => (
          <div key={section} className="form-section ingredient-section">
            <div className="row ingredient-section-header">
              <strong>Блок</strong>
              <input
                value={section}
                list="ingredient-section-suggestions"
                onChange={(event) => renameSection(section, event.target.value)}
                aria-label="Название блока ингредиентов"
              />
              <button type="button" className="btn btn-secondary" onClick={() => addIngredientToSection(section)}>
                + Ингредиент в блок
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => removeSection(section)}
                disabled={ingredientSections.length === 1}
              >
                Удалить блок
              </button>
            </div>

            {sectionItems.map(({ item, index }) => (
              <div key={`ingredient-${index}`} className="row ingredient-row">
                <input
                  placeholder="Название"
                  value={item.name}
                  onChange={(event) => updateIngredient(index, "name", event.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Кол-во (например: 100-150)"
                  value={item.amount}
                  onChange={(event) => updateIngredient(index, "amount", event.target.value)}
                  required
                />
                <select value={item.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)}>
                  <option value="г">г</option>
                  <option value="мл">мл</option>
                  <option value="шт">шт</option>
                  <option value="столовая ложка">столовая ложка</option>
                  <option value="чайная ложка">чайная ложка</option>
                </select>
                <button type="button" className="btn btn-danger" onClick={() => removeIngredient(index)}>
                  Удалить
                </button>
              </div>
            ))}
          </div>
        ))}
        <div className="row add-section-row">
          <input
            placeholder="Новый блок (например: Соус)"
            value={newSectionName}
            list="ingredient-section-suggestions"
            onChange={(event) => setNewSectionName(event.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={addSection}>
            + Добавить блок
          </button>
        </div>
      </section>
      <datalist id="ingredient-section-suggestions">
        {sectionSuggestions.map((section) => (
          <option key={section} value={section} />
        ))}
      </datalist>

      <section className="form-section">
        <h3>Шаги</h3>
        {form.steps.map((step, index) => (
          <div key={`step-${index}`} className="row step-row">
            <textarea value={step} rows={2} onChange={(event) => updateStep(index, event.target.value)} required />
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  steps: prev.steps.filter((_, i) => i !== index)
                }))
              }
              disabled={form.steps.length === 1}
            >
              Удалить
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              steps: [...prev.steps, ""]
            }))
          }
        >
          + Добавить шаг
        </button>
      </section>

      <section className="form-section">
        <label>
          Теги (через запятую)
          <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
        </label>
        {previewTags.length > 0 && (
          <div className="chips">
            {previewTags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="actions form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Сохранение..." : "Сохранить"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function MealPlanner() {
  const [weekStart, setWeekStart] = useState(() => toIsoDate(getStartOfWeek(new Date())));
  const [plans, setPlans] = useState<MealPlanItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [recipeId, setRecipeId] = useState<number | "">("");
  const [startDate, setStartDate] = useState(weekStart);
  const [endDate, setEndDate] = useState(weekStart);
  const [loading, setLoading] = useState(false);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingListText, setShoppingListText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const start = parseIsoDateLocal(weekStart);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start.getTime());
      day.setDate(start.getDate() + index);
      return toIsoDate(day);
    });
  }, [weekStart]);

  useEffect(() => {
    void (async () => {
      try {
        const allRecipes = await fetchRecipes({});
        setRecipes(allRecipes);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Не удалось загрузить рецепты для планирования");
      }
    })();
  }, []);

  useEffect(() => {
    setStartDate(weekStart);
    setEndDate(weekStart);
    setShoppingListText("");
  }, [weekStart]);

  useEffect(() => {
    void loadPlans();
  }, [weekStart]);

  async function loadPlans() {
    try {
      setLoading(true);
      setMessage(null);
      const data = await fetchMealPlans(weekStart);
      setPlans(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить план недели");
    } finally {
      setLoading(false);
    }
  }

  async function onCreatePlan(event: React.FormEvent) {
    event.preventDefault();
    if (recipeId === "") {
      setMessage("Выберите рецепт");
      return;
    }
    if (endDate < startDate) {
      setMessage("Дата окончания не может быть раньше даты начала");
      return;
    }
    try {
      setLoading(true);
      setMessage(null);
      await createMealPlan({ recipeId, startDate, endDate });
      await loadPlans();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить блюдо в план");
    } finally {
      setLoading(false);
    }
  }

  async function onDeletePlan(id: number) {
    try {
      setLoading(true);
      setMessage(null);
      await deleteMealPlan(id);
      await loadPlans();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить запись плана");
    } finally {
      setLoading(false);
    }
  }

  async function onGenerateShoppingList() {
    try {
      setShoppingLoading(true);
      setMessage(null);
      const response = await fetchShoppingList(weekStart);
      setShoppingListText(response.text);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось собрать список покупок");
    } finally {
      setShoppingLoading(false);
    }
  }

  async function onCopyShoppingList() {
    if (!shoppingListText.trim()) {
      setMessage("Сначала сформируйте список покупок");
      return;
    }
    try {
      await navigator.clipboard.writeText(shoppingListText);
      setMessage("Список покупок скопирован в буфер обмена");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось скопировать список");
    }
  }

  return (
    <section className="planner-view">
      <div className="planner-topbar card">
        <div className="planner-week-controls">
          <button type="button" className="btn btn-ghost" onClick={() => setWeekStart(toIsoDate(addDaysLocal(weekStart, -7)))}>
            ← Неделя назад
          </button>
          <div className="planner-week-label">
            {formatDateRu(weekDays[0])} - {formatDateRu(weekDays[6])}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setWeekStart(toIsoDate(addDaysLocal(weekStart, 7)))}>
            Неделя вперед →
          </button>
        </div>
        <div className="planner-shopping-actions">
          <button type="button" className="btn btn-primary" onClick={() => void onGenerateShoppingList()} disabled={shoppingLoading}>
            {shoppingLoading ? "Собираю список..." : "Сформировать список покупок"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void onCopyShoppingList()}>
            Скопировать для Telegram
          </button>
        </div>
      </div>

      <form className="planner-form card" onSubmit={(event) => void onCreatePlan(event)}>
        <h3>Добавить в план</h3>
        <div className="planner-form-grid">
          <label>
            Рецепт
            <select
              value={recipeId}
              onChange={(event) => setRecipeId(event.target.value ? Number(event.target.value) : "")}
              required
            >
              <option value="">Выберите рецепт</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            С даты
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </label>
          <label>
            По дату
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
          </label>
          <div className="planner-form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Добавить
            </button>
          </div>
        </div>
      </form>
      {message && <div className="alert">{message}</div>}
      {shoppingListText && (
        <section className="card shopping-list-card">
          <h3>Список покупок</h3>
          <textarea
            className="shopping-list-output"
            value={shoppingListText}
            readOnly
            rows={Math.min(18, Math.max(8, shoppingListText.split("\n").length + 1))}
          />
        </section>
      )}

      <div className="planner-grid">
        {weekDays.map((day) => {
          const plansForDay = plans.filter((plan) => plan.startDate <= day && plan.endDate >= day);
          return (
            <article key={day} className="planner-day card">
              <header className="planner-day-header">
                <strong>{formatWeekdayRu(day)}</strong>
                <span>{formatDateRu(day)}</span>
              </header>
              <div className="planner-day-items">
                {plansForDay.length === 0 && <p className="planner-empty">Нет запланированных блюд</p>}
                {plansForDay.map((plan) => (
                  <div key={plan.id} className="planner-item">
                    <div>
                      <div className="planner-item-title">{plan.recipeTitle}</div>
                      <div className="planner-item-meta">
                        {plan.recipeCategory} • {formatDateRu(plan.startDate)} - {formatDateRu(plan.endDate)}
                      </div>
                    </div>
                    <button type="button" className="btn btn-danger planner-item-remove" onClick={() => void onDeletePlan(plan.id)}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function parseIsoDateLocal(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysLocal(isoDate: string, amount: number): Date {
  const value = parseIsoDateLocal(isoDate);
  value.setDate(value.getDate() + amount);
  return value;
}

function getStartOfWeek(value: Date): Date {
  const copy = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function formatDateRu(isoDate: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(parseIsoDateLocal(isoDate));
}

function formatWeekdayRu(isoDate: string): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(parseIsoDateLocal(isoDate));
}
