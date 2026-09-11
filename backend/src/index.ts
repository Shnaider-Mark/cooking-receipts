import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { pool, withTransaction } from "./db.js";

dotenv.config();

type IngredientInput = {
  section: string;
  name: string;
  amount: string;
  unit: string;
};

type RecipeInput = {
  title: string;
  mealCategory: string;
  subcategory: string;
  mainIngredient: string;
  description?: string;
  sourceUrl?: string | null;
  servings?: number;
  prepTimeMin?: number;
  cookTimeMin?: number;
  photoUrl?: string | null;
  ingredients: IngredientInput[];
  steps: string[];
  tags: string[];
};

type MealPlanInput = {
  recipeId: number;
  startDate: string;
  endDate: string;
};

type DictionaryInput = {
  name: string;
};

type ShoppingListEntry = {
  name: string;
  unit: string;
  amount: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
const uploadsDirName = process.env.UPLOADS_DIR ?? "uploads";
const uploadsDir = path.resolve(__dirname, `../${uploadsDirName}`);

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const upload = multer({ storage });

app.use(
  cors({
    origin: frontendOrigin
  })
);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/admin", (_req, res) => {
  res.type("html").send(getAdminPageHtml());
});

app.get("/catalog/meal-categories", async (_req, res) => {
  const { rows } = await pool.query(
    `
    SELECT id, name
    FROM meal_categories
    ORDER BY name ASC
    `
  );
  res.json(rows);
});

app.post("/catalog/meal-categories", async (req, res) => {
  const validation = validateDictionaryPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  try {
    const result = await pool.query(
      `
      INSERT INTO meal_categories (name)
      VALUES ($1)
      RETURNING id
      `,
      [validation.data.name]
    );
    return res.status(201).json({ id: result.rows[0].id as number });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: "Категория уже существует" });
    }
    throw error;
  }
});

app.delete("/catalog/meal-categories/:id", async (req, res) => {
  const entryId = Number(req.params.id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return res.status(400).json({ error: "Invalid meal category id" });
  }

  const usedInRecipes = await pool.query(
    `
    SELECT 1
    FROM recipes r
    JOIN meal_categories c ON lower(c.name) = lower(r.meal_category)
    WHERE c.id = $1
    LIMIT 1
    `,
    [entryId]
  );
  if ((usedInRecipes.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: "Нельзя удалить категорию: она используется в рецептах" });
  }

  const result = await pool.query("DELETE FROM meal_categories WHERE id = $1", [entryId]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Meal category not found" });
  }
  res.json({ ok: true });
});

app.get("/catalog/subcategories", async (_req, res) => {
  const { rows } = await pool.query(
    `
    SELECT id, name
    FROM subcategories
    ORDER BY name ASC
    `
  );
  res.json(rows);
});

app.post("/catalog/subcategories", async (req, res) => {
  const validation = validateDictionaryPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  try {
    const result = await pool.query(
      `
      INSERT INTO subcategories (name)
      VALUES ($1)
      RETURNING id
      `,
      [validation.data.name]
    );
    return res.status(201).json({ id: result.rows[0].id as number });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: "Подкатегория уже существует" });
    }
    throw error;
  }
});

app.delete("/catalog/subcategories/:id", async (req, res) => {
  const entryId = Number(req.params.id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return res.status(400).json({ error: "Invalid subcategory id" });
  }

  const usedInRecipes = await pool.query(
    `
    SELECT 1
    FROM recipes r
    JOIN subcategories c ON lower(c.name) = lower(r.subcategory)
    WHERE c.id = $1
    LIMIT 1
    `,
    [entryId]
  );
  if ((usedInRecipes.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: "Нельзя удалить подкатегорию: она используется в рецептах" });
  }

  const result = await pool.query("DELETE FROM subcategories WHERE id = $1", [entryId]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Subcategory not found" });
  }
  res.json({ ok: true });
});

app.get("/catalog/main-ingredients", async (_req, res) => {
  const { rows } = await pool.query(
    `
    SELECT id, name
    FROM categories
    ORDER BY name ASC
    `
  );
  res.json(rows);
});

app.post("/catalog/main-ingredients", async (req, res) => {
  const validation = validateDictionaryPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  try {
    const result = await pool.query(
      `
      INSERT INTO categories (name)
      VALUES ($1)
      RETURNING id
      `,
      [validation.data.name]
    );
    return res.status(201).json({ id: result.rows[0].id as number });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: "Основной ингредиент уже существует" });
    }
    throw error;
  }
});

app.delete("/catalog/main-ingredients/:id", async (req, res) => {
  const entryId = Number(req.params.id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return res.status(400).json({ error: "Invalid main ingredient id" });
  }

  const usedInRecipes = await pool.query(
    `
    SELECT 1
    FROM recipes r
    JOIN categories c ON lower(c.name) = lower(r.main_ingredient)
    WHERE c.id = $1
    LIMIT 1
    `,
    [entryId]
  );
  if ((usedInRecipes.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: "Нельзя удалить основной ингредиент: он используется в рецептах" });
  }

  const result = await pool.query("DELETE FROM categories WHERE id = $1", [entryId]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Main ingredient not found" });
  }
  res.json({ ok: true });
});

app.get("/catalog/ingredients", async (_req, res) => {
  const { rows } = await pool.query(
    `
    SELECT id, name
    FROM ingredients_catalog
    ORDER BY name ASC
    `
  );
  res.json(rows);
});

app.post("/catalog/ingredients", async (req, res) => {
  const validation = validateDictionaryPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  try {
    const result = await pool.query(
      `
      INSERT INTO ingredients_catalog (name)
      VALUES ($1)
      RETURNING id
      `,
      [validation.data.name]
    );
    return res.status(201).json({ id: result.rows[0].id as number });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: "Ингредиент уже существует" });
    }
    throw error;
  }
});

app.delete("/catalog/ingredients/:id", async (req, res) => {
  const ingredientId = Number(req.params.id);
  if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
    return res.status(400).json({ error: "Invalid ingredient id" });
  }

  const usedInRecipes = await pool.query(
    `
    SELECT 1
    FROM recipe_ingredients ri
    JOIN ingredients_catalog ic ON lower(ic.name) = lower(ri.name)
    WHERE ic.id = $1
    LIMIT 1
    `,
    [ingredientId]
  );
  if ((usedInRecipes.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: "Нельзя удалить ингредиент: он используется в рецептах" });
  }

  const result = await pool.query("DELETE FROM ingredients_catalog WHERE id = $1", [ingredientId]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Ingredient not found" });
  }
  res.json({ ok: true });
});

app.get("/recipes", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : null;
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : null;
  const mealCategory = typeof req.query.mealCategory === "string" ? req.query.mealCategory.trim() : null;
  const subcategory = typeof req.query.subcategory === "string" ? req.query.subcategory.trim() : null;
  const mainIngredient = typeof req.query.mainIngredient === "string" ? req.query.mainIngredient.trim() : null;
  const ingredient = typeof req.query.ingredient === "string" ? req.query.ingredient.trim() : null;

  const { rows } = await pool.query(
    `
    SELECT
      r.id,
      r.title,
      r.meal_category AS "mealCategory",
      r.subcategory,
      r.main_ingredient AS "mainIngredient",
      r.category,
      r.description,
      r.source_url AS "sourceUrl",
      r.servings,
      r.prep_time_min AS "prepTimeMin",
      r.cook_time_min AS "cookTimeMin",
      r.photo_url AS "photoUrl",
      r.created_at AS "createdAt",
      r.updated_at AS "updatedAt",
      COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
    FROM recipes r
    LEFT JOIN recipe_tags rt ON rt.recipe_id = r.id
    LEFT JOIN tags t ON t.id = rt.tag_id
    WHERE
      ($1::text IS NULL OR r.title ILIKE '%' || $1 || '%')
      AND ($2::text IS NULL OR EXISTS (
        SELECT 1
        FROM recipe_tags rt2
        JOIN tags t2 ON t2.id = rt2.tag_id
        WHERE rt2.recipe_id = r.id AND t2.name = $2
      ))
      AND ($3::text IS NULL OR r.meal_category = $3)
      AND ($4::text IS NULL OR r.subcategory = $4)
      AND ($5::text IS NULL OR r.main_ingredient = $5)
      AND ($6::text IS NULL OR EXISTS (
        SELECT 1
        FROM recipe_ingredients ri2
        WHERE ri2.recipe_id = r.id AND lower(ri2.name) = lower($6)
      ))
    GROUP BY r.id
    ORDER BY r.updated_at DESC
    `,
    [query, tag, mealCategory, subcategory, mainIngredient, ingredient]
  );

  res.json(rows);
});

app.get("/recipes/:id", async (req, res) => {
  const recipeId = Number(req.params.id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return res.status(400).json({ error: "Invalid recipe id" });
  }

  const recipeResult = await pool.query(
    `
    SELECT
      r.id,
      r.title,
      r.meal_category AS "mealCategory",
      r.subcategory,
      r.main_ingredient AS "mainIngredient",
      r.category,
      r.description,
      r.source_url AS "sourceUrl",
      r.servings,
      r.prep_time_min AS "prepTimeMin",
      r.cook_time_min AS "cookTimeMin",
      r.photo_url AS "photoUrl",
      r.created_at AS "createdAt",
      r.updated_at AS "updatedAt"
    FROM recipes r
    WHERE r.id = $1
    `,
    [recipeId]
  );

  if (recipeResult.rowCount === 0) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  const ingredientsResult = await pool.query(
    `
    SELECT section, name, amount, unit, position
    FROM recipe_ingredients
    WHERE recipe_id = $1
    ORDER BY position ASC
    `,
    [recipeId]
  );

  const stepsResult = await pool.query(
    `
    SELECT step_text AS text, position
    FROM recipe_steps
    WHERE recipe_id = $1
    ORDER BY position ASC
    `,
    [recipeId]
  );

  const tagsResult = await pool.query(
    `
    SELECT t.name
    FROM recipe_tags rt
    JOIN tags t ON t.id = rt.tag_id
    WHERE rt.recipe_id = $1
    ORDER BY t.name ASC
    `,
    [recipeId]
  );

  return res.json({
    ...recipeResult.rows[0],
    ingredients: ingredientsResult.rows.map((row: { section: string; name: string; amount: string; unit: string }) => ({
      section: row.section,
      name: row.name,
      amount: row.amount,
      unit: row.unit
    })),
    steps: stepsResult.rows.map((row: { text: string }) => row.text),
    tags: tagsResult.rows.map((row: { name: string }) => row.name)
  });
});

app.get("/meal-plans", async (req, res) => {
  const weekStartRaw = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
  const weekStart = parseIsoDate(weekStartRaw);
  if (!weekStart) {
    return res.status(400).json({ error: "weekStart must be in YYYY-MM-DD format" });
  }
  const weekEnd = addDays(weekStart, 6);
  const weekStartDate = toIsoDate(weekStart);
  const weekEndDate = toIsoDate(weekEnd);

  const { rows } = await pool.query(
    `
    SELECT
      mp.id,
      mp.recipe_id AS "recipeId",
      mp.start_date::text AS "startDate",
      mp.end_date::text AS "endDate",
      mp.created_at AS "createdAt",
      r.title AS "recipeTitle",
      r.main_ingredient AS "recipeCategory"
    FROM meal_plans mp
    JOIN recipes r ON r.id = mp.recipe_id
    WHERE mp.start_date <= $2::date
      AND mp.end_date >= $1::date
    ORDER BY mp.start_date ASC, mp.id ASC
    `,
    [weekStartDate, weekEndDate]
  );

  res.json(rows);
});

app.post("/recipes", async (req, res) => {
  const validation = validateRecipePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const data = validation.data;

  const mealCategoryExists = await dictionaryValueExists("meal_categories", data.mealCategory);
  if (!mealCategoryExists) {
    return res.status(400).json({ error: "Категория не найдена в админ-справочнике" });
  }
  const subcategoryExists = await dictionaryValueExists("subcategories", data.subcategory);
  if (!subcategoryExists) {
    return res.status(400).json({ error: "Подкатегория не найдена в админ-справочнике" });
  }
  const mainIngredientExists = await dictionaryValueExists("categories", data.mainIngredient);
  if (!mainIngredientExists) {
    return res.status(400).json({ error: "Основной ингредиент не найден в админ-справочнике" });
  }
  const missingIngredients = await findMissingIngredients(data.ingredients.map((item) => item.name));
  if (missingIngredients.length > 0) {
    return res.status(400).json({ error: `Ингредиенты не найдены в админ-справочнике: ${missingIngredients.join(", ")}` });
  }

  const recipe = await withTransaction(async (client) => {
    const insertRecipeResult = await client.query(
      `
      INSERT INTO recipes (
        title,
        meal_category,
        subcategory,
        main_ingredient,
        category,
        description,
        source_url,
        servings,
        prep_time_min,
        cook_time_min,
        photo_url
      )
      VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
      `,
      [
        data.title,
        data.mealCategory,
        data.subcategory,
        data.mainIngredient,
        data.description ?? "",
        data.sourceUrl ?? null,
        data.servings ?? 1,
        data.prepTimeMin ?? 0,
        data.cookTimeMin ?? 0,
        data.photoUrl ?? null
      ]
    );

    const recipeId = insertRecipeResult.rows[0].id as number;
    await insertIngredients(client, recipeId, data.ingredients);
    await insertSteps(client, recipeId, data.steps);
    await upsertRecipeTags(client, recipeId, data.tags);
    return recipeId;
  });

  res.status(201).json({ id: recipe });
});

app.put("/recipes/:id", async (req, res) => {
  const recipeId = Number(req.params.id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return res.status(400).json({ error: "Invalid recipe id" });
  }

  const validation = validateRecipePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const data = validation.data;

  const mealCategoryExists = await dictionaryValueExists("meal_categories", data.mealCategory);
  if (!mealCategoryExists) {
    return res.status(400).json({ error: "Категория не найдена в админ-справочнике" });
  }
  const subcategoryExists = await dictionaryValueExists("subcategories", data.subcategory);
  if (!subcategoryExists) {
    return res.status(400).json({ error: "Подкатегория не найдена в админ-справочнике" });
  }
  const mainIngredientExists = await dictionaryValueExists("categories", data.mainIngredient);
  if (!mainIngredientExists) {
    return res.status(400).json({ error: "Основной ингредиент не найден в админ-справочнике" });
  }
  const missingIngredients = await findMissingIngredients(data.ingredients.map((item) => item.name));
  if (missingIngredients.length > 0) {
    return res.status(400).json({ error: `Ингредиенты не найдены в админ-справочнике: ${missingIngredients.join(", ")}` });
  }

  const exists = await pool.query("SELECT id FROM recipes WHERE id = $1", [recipeId]);
  if (exists.rowCount === 0) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  await withTransaction(async (client) => {
    await client.query(
      `
      UPDATE recipes
      SET title = $1,
          meal_category = $2,
          subcategory = $3,
          main_ingredient = $4,
          category = $4,
          description = $5,
          source_url = $6,
          servings = $7,
          prep_time_min = $8,
          cook_time_min = $9,
          photo_url = $10,
          updated_at = NOW()
      WHERE id = $11
      `,
      [
        data.title,
        data.mealCategory,
        data.subcategory,
        data.mainIngredient,
        data.description ?? "",
        data.sourceUrl ?? null,
        data.servings ?? 1,
        data.prepTimeMin ?? 0,
        data.cookTimeMin ?? 0,
        data.photoUrl ?? null,
        recipeId
      ]
    );

    await client.query("DELETE FROM recipe_ingredients WHERE recipe_id = $1", [recipeId]);
    await client.query("DELETE FROM recipe_steps WHERE recipe_id = $1", [recipeId]);
    await client.query("DELETE FROM recipe_tags WHERE recipe_id = $1", [recipeId]);

    await insertIngredients(client, recipeId, data.ingredients);
    await insertSteps(client, recipeId, data.steps);
    await upsertRecipeTags(client, recipeId, data.tags);
  });

  res.json({ ok: true });
});

app.delete("/recipes/:id", async (req, res) => {
  const recipeId = Number(req.params.id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return res.status(400).json({ error: "Invalid recipe id" });
  }

  const result = await pool.query("DELETE FROM recipes WHERE id = $1", [recipeId]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  res.json({ ok: true });
});

app.post("/meal-plans", async (req, res) => {
  const validation = validateMealPlanPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const data = validation.data;

  const recipeExists = await pool.query("SELECT id FROM recipes WHERE id = $1", [data.recipeId]);
  if (recipeExists.rowCount === 0) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  const insertResult = await pool.query(
    `
    INSERT INTO meal_plans (recipe_id, start_date, end_date)
    VALUES ($1, $2::date, $3::date)
    RETURNING id
    `,
    [data.recipeId, data.startDate, data.endDate]
  );

  res.status(201).json({ id: insertResult.rows[0].id as number });
});

app.delete("/meal-plans/:id", async (req, res) => {
  const planId = Number(req.params.id);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: "Invalid meal plan id" });
  }

  const result = await pool.query("DELETE FROM meal_plans WHERE id = $1", [planId]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Meal plan not found" });
  }

  res.json({ ok: true });
});

app.get("/shopping-list", async (req, res) => {
  const weekStartRaw = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
  const weekStart = parseIsoDate(weekStartRaw);
  if (!weekStart) {
    return res.status(400).json({ error: "weekStart must be in YYYY-MM-DD format" });
  }
  const weekEnd = addDays(weekStart, 6);
  const weekStartDate = toIsoDate(weekStart);
  const weekEndDate = toIsoDate(weekEnd);

  const { rows } = await pool.query(
    `
    SELECT
      mp.id AS "planId",
      r.title AS "recipeTitle",
      ri.name,
      ri.amount,
      ri.unit
    FROM meal_plans mp
    JOIN recipes r ON r.id = mp.recipe_id
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    WHERE mp.start_date <= $2::date
      AND mp.end_date >= $1::date
    ORDER BY ri.name ASC
    `,
    [weekStartDate, weekEndDate]
  );

  const aggregated = aggregateShoppingList(
    rows.map((row: { planId: number; name: string; amount: string; unit: string }) => ({
      planId: row.planId,
      name: row.name,
      amount: row.amount,
      unit: row.unit
    }))
  );

  const text = buildShoppingListText(weekStartDate, weekEndDate, aggregated);

  res.json({
    weekStart: weekStartDate,
    weekEnd: weekEndDate,
    items: aggregated,
    text
  });
});

app.post("/uploads/photo", upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Photo is required" });
  }
  return res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

function validateRecipePayload(payload: unknown): { valid: true; data: RecipeInput } | { valid: false; error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { valid: false, error: "Payload must be an object" };
  }

  const obj = payload as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!title) {
    return { valid: false, error: "Title is required" };
  }
  const legacyCategory = typeof obj.category === "string" ? obj.category.trim() : "";
  const mealCategoryRaw = typeof obj.mealCategory === "string" ? obj.mealCategory.trim() : "";
  const subcategoryRaw = typeof obj.subcategory === "string" ? obj.subcategory.trim() : "";
  const mainIngredientRaw = typeof obj.mainIngredient === "string" ? obj.mainIngredient.trim() : "";
  const mealCategory = mealCategoryRaw || "Ужин";
  const subcategory = subcategoryRaw || "Другое";
  const mainIngredient = mainIngredientRaw || legacyCategory;
  if (!mainIngredient) {
    return { valid: false, error: "Выберите основной ингредиент" };
  }
  const sourceUrlRaw = typeof obj.sourceUrl === "string" ? obj.sourceUrl.trim() : "";
  if (sourceUrlRaw && !isValidWebUrl(sourceUrlRaw)) {
    return { valid: false, error: "Ссылка на источник должна начинаться с http:// или https://" };
  }

  if (!Array.isArray(obj.ingredients) || obj.ingredients.length === 0) {
    return { valid: false, error: "Добавьте хотя бы один ингредиент" };
  }
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return { valid: false, error: "Добавьте хотя бы один шаг" };
  }

  const ingredients: IngredientInput[] = [];
  const ingredientNamesSeen = new Set<string>();
  for (const item of obj.ingredients) {
    if (typeof item !== "object" || item === null) {
      return { valid: false, error: "Некорректный ингредиент" };
    }
    const ingredient = item as Record<string, unknown>;
    const section = typeof ingredient.section === "string" ? ingredient.section.trim() : "";
    const name = typeof ingredient.name === "string" ? ingredient.name.trim() : "";
    const amount = typeof ingredient.amount === "string" ? ingredient.amount.trim() : "";
    const unit = typeof ingredient.unit === "string" ? ingredient.unit.trim() : "";
    if (!section || !name || !amount || !unit) {
      return { valid: false, error: "Заполните все поля ингредиента" };
    }
    const normalizedName = name.toLocaleLowerCase("ru-RU");
    if (ingredientNamesSeen.has(normalizedName)) {
      return { valid: false, error: `Ингредиент "${name}" повторяется. Укажи его только один раз.` };
    }
    ingredientNamesSeen.add(normalizedName);
    ingredients.push({ section, name, amount, unit });
  }

  const steps: string[] = [];
  for (const item of obj.steps) {
    const step = typeof item === "string" ? item.trim() : "";
    if (!step) {
      return { valid: false, error: "Текст шага не может быть пустым" };
    }
    steps.push(step);
  }

  const tags: string[] = [];
  const rawTags = Array.isArray(obj.tags) ? obj.tags : [];
  for (const item of rawTags) {
    const tag = typeof item === "string" ? item.trim() : "";
    if (tag) {
      tags.push(tag);
    }
  }

  return {
    valid: true,
    data: {
      title,
      mealCategory,
      subcategory,
      mainIngredient,
      description: typeof obj.description === "string" ? obj.description.trim() : "",
      sourceUrl: sourceUrlRaw || null,
      servings: Number(obj.servings) > 0 ? Number(obj.servings) : 1,
      prepTimeMin: Number(obj.prepTimeMin) >= 0 ? Number(obj.prepTimeMin) : 0,
      cookTimeMin: Number(obj.cookTimeMin) >= 0 ? Number(obj.cookTimeMin) : 0,
      photoUrl: typeof obj.photoUrl === "string" ? obj.photoUrl.trim() : null,
      ingredients,
      steps,
      tags
    }
  };
}

function validateMealPlanPayload(payload: unknown): { valid: true; data: MealPlanInput } | { valid: false; error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { valid: false, error: "Payload must be an object" };
  }
  const obj = payload as Record<string, unknown>;
  const recipeId = Number(obj.recipeId);
  const startDate = typeof obj.startDate === "string" ? obj.startDate.trim() : "";
  const endDate = typeof obj.endDate === "string" ? obj.endDate.trim() : "";

  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return { valid: false, error: "recipeId must be a positive integer" };
  }
  const parsedStartDate = parseIsoDate(startDate);
  const parsedEndDate = parseIsoDate(endDate);
  if (!parsedStartDate || !parsedEndDate) {
    return { valid: false, error: "Dates must be in YYYY-MM-DD format" };
  }
  if (parsedEndDate.getTime() < parsedStartDate.getTime()) {
    return { valid: false, error: "endDate must be greater than or equal to startDate" };
  }

  return {
    valid: true,
    data: {
      recipeId,
      startDate: toIsoDate(parsedStartDate),
      endDate: toIsoDate(parsedEndDate)
    }
  };
}

async function insertIngredients(client: import("pg").PoolClient, recipeId: number, items: IngredientInput[]) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    await client.query(
      `
      INSERT INTO recipe_ingredients (recipe_id, section, name, amount, unit, position)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [recipeId, item.section, item.name, item.amount, item.unit, index]
    );
  }
}

async function insertSteps(client: import("pg").PoolClient, recipeId: number, steps: string[]) {
  for (let index = 0; index < steps.length; index += 1) {
    await client.query(
      `
      INSERT INTO recipe_steps (recipe_id, step_text, position)
      VALUES ($1, $2, $3)
      `,
      [recipeId, steps[index], index]
    );
  }
}

async function upsertRecipeTags(client: import("pg").PoolClient, recipeId: number, tags: string[]) {
  for (const tag of Array.from(new Set(tags))) {
    const tagResult = await client.query(
      `
      INSERT INTO tags (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
      `,
      [tag]
    );

    await client.query(
      `
      INSERT INTO recipe_tags (recipe_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT (recipe_id, tag_id) DO NOTHING
      `,
      [recipeId, tagResult.rows[0].id]
    );
  }
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function addDays(baseDate: Date, days: number): Date {
  const nextDate = new Date(baseDate.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function aggregateShoppingList(
  rows: Array<{ planId: number; name: string; amount: string; unit: string }>
): ShoppingListEntry[] {
  const byKey = new Map<string, { displayName: string; displayUnit: string; amounts: string[]; numericTotal: number | null }>();
  const processedRows = dedupeByPlanIngredient(rows);

  for (const row of processedRows) {
    const name = row.name.trim();
    const unit = row.unit.trim();
    const amount = row.amount.trim();
    if (!name || !unit || !amount) {
      continue;
    }
    const key = `${name.toLocaleLowerCase("ru-RU")}::${unit.toLocaleLowerCase("ru-RU")}`;
    const current = byKey.get(key) ?? { displayName: name, displayUnit: unit, amounts: [], numericTotal: 0 };
    const numericAmount = parseNumericAmount(amount);

    if (numericAmount === null || current.numericTotal === null) {
      current.numericTotal = null;
      current.amounts.push(amount);
    } else {
      current.numericTotal += numericAmount;
    }

    byKey.set(key, current);
  }

  return Array.from(byKey.entries())
    .map(([key, value]) => {
      const amount =
        value.numericTotal !== null
          ? formatNumericAmount(value.numericTotal)
          : Array.from(new Set(value.amounts)).join(" + ");
      return {
        name: value.displayName,
        unit: value.displayUnit,
        amount
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru-RU"));
}

function buildShoppingListText(weekStart: string, weekEnd: string, items: ShoppingListEntry[]): string {
  const header = `Список покупок (${weekStart} - ${weekEnd})`;
  if (items.length === 0) {
    return `${header}\n\nНа выбранную неделю ничего не запланировано.`;
  }
  const lines = items.map((item) => `- [ ] ${item.name} — ${item.amount} ${item.unit}`);
  return [header, "", ...lines].join("\n");
}

function parseNumericAmount(amount: string): number | null {
  const normalized = amount.replace(",", ".").trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumericAmount(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

function dedupeByPlanIngredient(
  rows: Array<{ planId: number; name: string; amount: string; unit: string }>
): Array<{ planId: number; name: string; amount: string; unit: string }> {
  const seen = new Set<string>();
  const output: Array<{ planId: number; name: string; amount: string; unit: string }> = [];
  for (const row of rows) {
    const signature = `${row.planId}|${row.name}|${row.amount}|${row.unit}`;
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    output.push(row);
  }
  return output;
}

function isValidWebUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateDictionaryPayload(
  payload: unknown
): { valid: true; data: DictionaryInput } | { valid: false; error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { valid: false, error: "Payload must be an object" };
  }
  const obj = payload as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) {
    return { valid: false, error: "Name is required" };
  }
  return { valid: true, data: { name } };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  return "code" in error && (error as { code?: string }).code === "23505";
}

async function dictionaryValueExists(
  table: "categories" | "ingredients_catalog" | "meal_categories" | "subcategories",
  name: string
): Promise<boolean> {
  const result = await pool.query(`SELECT 1 FROM ${table} WHERE lower(name) = lower($1) LIMIT 1`, [name.trim()]);
  return (result.rowCount ?? 0) > 0;
}

async function findMissingIngredients(names: string[]): Promise<string[]> {
  const normalizedNames = Array.from(
    new Set(
      names
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toLocaleLowerCase("ru-RU"))
    )
  );
  if (normalizedNames.length === 0) {
    return [];
  }

  const { rows } = await pool.query(
    `
    SELECT lower(name) AS normalized
    FROM ingredients_catalog
    WHERE lower(name) = ANY($1::text[])
    `,
    [normalizedNames]
  );
  const existing = new Set(rows.map((row: { normalized: string }) => row.normalized));
  return normalizedNames.filter((name) => !existing.has(name));
}

function getAdminPageHtml(): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cooking Receipts Admin</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; background: #f6f8fb; margin: 0; color: #1e293b; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 24px 16px; }
    h1 { margin: 0 0 16px; }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
    form { display: flex; gap: 8px; margin-bottom: 10px; }
    input { flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid #cbd5e1; }
    button { border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; padding: 8px 10px; cursor: pointer; }
    button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow: auto; }
    li { display: flex; justify-content: space-between; gap: 8px; align-items: center; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
    .muted { color: #64748b; font-size: 14px; }
    .msg { margin: 0 0 10px; color: #334155; font-size: 14px; min-height: 18px; }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Админка справочников</h1>
    <p class="muted">Управление справочниками: категории, подкатегории, основные ингредиенты и ингредиенты.</p>
    <p id="message" class="msg"></p>
    <div class="grid">
      <section class="card" id="mealCategoryCard"></section>
      <section class="card" id="subcategoryCard"></section>
      <section class="card" id="mainIngredientCard"></section>
      <section class="card" id="ingredientCard"></section>
    </div>
  </main>
  <script>
    const messageNode = document.getElementById("message");
    const sections = [
      { key: "mealCategory", title: "Категории (прием пищи)", placeholder: "Например: Завтрак", endpoint: "/catalog/meal-categories", cardId: "mealCategoryCard" },
      { key: "subcategory", title: "Подкатегории (тип блюда)", placeholder: "Например: Котлеты", endpoint: "/catalog/subcategories", cardId: "subcategoryCard" },
      { key: "mainIngredient", title: "Основные ингредиенты", placeholder: "Например: Говядина", endpoint: "/catalog/main-ingredients", cardId: "mainIngredientCard" },
      { key: "ingredient", title: "Ингредиенты", placeholder: "Например: Лук", endpoint: "/catalog/ingredients", cardId: "ingredientCard" }
    ];

    function setMessage(text) { messageNode.textContent = text || ""; }

    async function request(path, init) {
      const response = await fetch(path, init);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(payload.error || "Ошибка запроса");
      }
      return response.json().catch(() => ({}));
    }

    function createSectionDom(section) {
      const card = document.getElementById(section.cardId);
      card.innerHTML = "";
      const title = document.createElement("h2");
      title.textContent = section.title;
      const form = document.createElement("form");
      form.id = section.key + "Form";
      const input = document.createElement("input");
      input.id = section.key + "Input";
      input.placeholder = section.placeholder;
      const button = document.createElement("button");
      button.type = "submit";
      button.className = "primary";
      button.textContent = "Добавить";
      form.append(input, button);
      const list = document.createElement("ul");
      list.id = section.key + "List";
      card.append(title, form, list);
      return { form, input, list };
    }

    function renderList(container, items, endpoint) {
      container.innerHTML = "";
      if (!items.length) {
        const li = document.createElement("li");
        li.textContent = "Список пуст";
        container.appendChild(li);
        return;
      }
      for (const item of items) {
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = item.name;
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Удалить";
        removeBtn.addEventListener("click", async () => {
          try {
            await request(\`\${endpoint}/\${item.id}\`, { method: "DELETE" });
            setMessage("Удалено");
            await load();
          } catch (error) {
            setMessage(error.message);
          }
        });
        li.append(label, removeBtn);
        container.appendChild(li);
      }
    }

    const sectionNodes = sections.map((section) => ({ section, ...createSectionDom(section) }));

    sectionNodes.forEach(({ section, form, input }) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) { return; }
        try {
          await request(section.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
          });
          input.value = "";
          setMessage("Запись добавлена");
          await load();
        } catch (error) {
          setMessage(error.message);
        }
      });
    });

    async function load() {
      const all = await Promise.all(sectionNodes.map(({ section }) => request(section.endpoint)));
      sectionNodes.forEach(({ section, list }, index) => {
        renderList(list, all[index], section.endpoint);
      });
    }

    load().catch((error) => setMessage(error.message));
  </script>
</body>
</html>`;
}
