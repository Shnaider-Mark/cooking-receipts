import { useEffect, useMemo, useState } from "react";
import {
  createRecipe,
  deleteRecipe,
  fetchRecipe,
  fetchRecipes,
  getImageUrl,
  updateRecipe,
  uploadPhoto
} from "./api";
import type { RecipeDetail, RecipeListItem, RecipePayload } from "./types";

type ViewState =
  | { mode: "list" }
  | { mode: "detail"; id: number }
  | { mode: "create" }
  | { mode: "edit"; id: number };

const EMPTY_RECIPE: RecipePayload = {
  title: "",
  description: "",
  servings: 1,
  prepTimeMin: 0,
  cookTimeMin: 0,
  photoUrl: null,
  ingredients: [{ name: "", amount: 100, unit: "г" }],
  steps: [""],
  tags: []
};

export default function App() {
  const [view, setView] = useState<ViewState>({ mode: "list" });
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(
    () => Array.from(new Set(recipes.flatMap((recipe) => recipe.tags))).sort((a, b) => a.localeCompare(b)),
    [recipes]
  );

  useEffect(() => {
    void loadRecipes();
  }, [search, activeTag]);

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
      const data = await fetchRecipes({ q: search, tag: activeTag });
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
        <h1>Мои рецепты</h1>
        <button type="button" onClick={() => setView({ mode: "create" })}>
          + Новый рецепт
        </button>
      </header>

      {error && <div className="alert error">{error}</div>}
      {loading && <div className="alert">Загрузка...</div>}

      {view.mode === "list" && (
        <section>
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
          </div>
          <div className="card-grid">
            {recipes.map((recipe) => (
              <article key={recipe.id} className="card">
                <h3>{recipe.title}</h3>
                <p>{recipe.description || "Без описания"}</p>
                <div className="chips">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="actions">
                  <button type="button" onClick={() => setView({ mode: "detail", id: recipe.id })}>
                    Открыть
                  </button>
                  <button type="button" onClick={() => setView({ mode: "edit", id: recipe.id })}>
                    Редактировать
                  </button>
                  <button type="button" className="danger" onClick={() => void onDeleteRecipe(recipe.id)}>
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {view.mode === "detail" && selectedRecipe && (
        <section className="detail">
          <button type="button" onClick={() => setView({ mode: "list" })}>
            ← К списку
          </button>
          <h2>{selectedRecipe.title}</h2>
          {getImageUrl(selectedRecipe.photoUrl) && (
            <img src={getImageUrl(selectedRecipe.photoUrl) ?? ""} alt={selectedRecipe.title} className="photo" />
          )}
          <p>{selectedRecipe.description || "Без описания"}</p>
          <p>
            Порций: {selectedRecipe.servings} | Подготовка: {selectedRecipe.prepTimeMin} мин | Готовка:{" "}
            {selectedRecipe.cookTimeMin} мин
          </p>
          <h3>Ингредиенты</h3>
          <ul>
            {selectedRecipe.ingredients.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                {item.name}: {item.amount} {item.unit}
              </li>
            ))}
          </ul>
          <h3>Шаги</h3>
          <ol>
            {selectedRecipe.steps.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ol>
          <div className="chips">
            {selectedRecipe.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
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
    </div>
  );
}

function RecipeForm(props: { recipeId: number | null; onCancel: () => void; onSaved: (id: number) => Promise<void> }) {
  const { recipeId, onCancel, onSaved } = props;
  const [form, setForm] = useState<RecipePayload>(EMPTY_RECIPE);
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId) {
      setForm(EMPTY_RECIPE);
      setTagsInput("");
      return;
    }
    void (async () => {
      const recipe = await fetchRecipe(recipeId);
      setForm({
        title: recipe.title,
        description: recipe.description ?? "",
        servings: recipe.servings,
        prepTimeMin: recipe.prepTimeMin,
        cookTimeMin: recipe.cookTimeMin,
        photoUrl: recipe.photoUrl,
        ingredients: recipe.ingredients.length ? recipe.ingredients : [{ name: "", amount: 100, unit: "г" }],
        steps: recipe.steps.length ? recipe.steps : [""],
        tags: recipe.tags
      });
      setTagsInput(recipe.tags.join(", "));
    })();
  }, [recipeId]);

  function updateIngredient(index: number, field: "name" | "amount" | "unit", value: string) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "amount" ? Number(value) : value
            }
          : item
      )
    }));
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
      ingredients: form.ingredients.map((item) => ({
        ...item,
        name: item.name.trim(),
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
    <form className="form" onSubmit={(event) => void submit(event)}>
      <h2>{recipeId ? "Редактирование рецепта" : "Новый рецепт"}</h2>
      {message && <div className="alert">{message}</div>}

      <label>
        Название
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
      </label>

      <label>
        Описание
        <textarea
          value={form.description}
          rows={3}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </label>

      <div className="row">
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
      {getImageUrl(form.photoUrl) && <img src={getImageUrl(form.photoUrl) ?? ""} alt="Рецепт" className="photo" />}

      <h3>Ингредиенты</h3>
      {form.ingredients.map((item, index) => (
        <div key={`ingredient-${index}`} className="row">
          <input
            placeholder="Название"
            value={item.name}
            onChange={(event) => updateIngredient(index, "name", event.target.value)}
            required
          />
          <input
            type="number"
            min={1}
            step="0.1"
            placeholder="Кол-во"
            value={item.amount}
            onChange={(event) => updateIngredient(index, "amount", event.target.value)}
            required
          />
          <select value={item.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)}>
            <option value="г">г</option>
            <option value="мл">мл</option>
            <option value="шт">шт</option>
          </select>
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                ingredients: prev.ingredients.filter((_, i) => i !== index)
              }))
            }
            disabled={form.ingredients.length === 1}
          >
            Удалить
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setForm((prev) => ({
            ...prev,
            ingredients: [...prev.ingredients, { name: "", amount: 100, unit: "г" }]
          }))
        }
      >
        + Добавить ингредиент
      </button>

      <h3>Шаги</h3>
      {form.steps.map((step, index) => (
        <div key={`step-${index}`} className="row">
          <textarea value={step} rows={2} onChange={(event) => updateStep(index, event.target.value)} required />
          <button
            type="button"
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
        onClick={() =>
          setForm((prev) => ({
            ...prev,
            steps: [...prev.steps, ""]
          }))
        }
      >
        + Добавить шаг
      </button>

      <label>
        Теги (через запятую)
        <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
      </label>

      <div className="actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Сохранение..." : "Сохранить"}
        </button>
        <button type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
