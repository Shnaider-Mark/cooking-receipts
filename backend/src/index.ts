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
  name: string;
  amount: number;
  unit: string;
};

type RecipeInput = {
  title: string;
  description?: string;
  servings?: number;
  prepTimeMin?: number;
  cookTimeMin?: number;
  photoUrl?: string | null;
  ingredients: IngredientInput[];
  steps: string[];
  tags: string[];
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

app.get("/recipes", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : null;
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : null;

  const { rows } = await pool.query(
    `
    SELECT
      r.id,
      r.title,
      r.description,
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
    GROUP BY r.id
    ORDER BY r.updated_at DESC
    `,
    [query, tag]
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
      r.description,
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
    SELECT name, amount::float AS amount, unit, position
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
    ingredients: ingredientsResult.rows.map((row: { name: string; amount: number; unit: string }) => ({
      name: row.name,
      amount: row.amount,
      unit: row.unit
    })),
    steps: stepsResult.rows.map((row: { text: string }) => row.text),
    tags: tagsResult.rows.map((row: { name: string }) => row.name)
  });
});

app.post("/recipes", async (req, res) => {
  const validation = validateRecipePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const data = validation.data;

  const recipe = await withTransaction(async (client) => {
    const insertRecipeResult = await client.query(
      `
      INSERT INTO recipes (title, description, servings, prep_time_min, cook_time_min, photo_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        data.title,
        data.description ?? "",
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

  const exists = await pool.query("SELECT id FROM recipes WHERE id = $1", [recipeId]);
  if (exists.rowCount === 0) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  await withTransaction(async (client) => {
    await client.query(
      `
      UPDATE recipes
      SET title = $1,
          description = $2,
          servings = $3,
          prep_time_min = $4,
          cook_time_min = $5,
          photo_url = $6,
          updated_at = NOW()
      WHERE id = $7
      `,
      [
        data.title,
        data.description ?? "",
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

  if (!Array.isArray(obj.ingredients) || obj.ingredients.length === 0) {
    return { valid: false, error: "At least one ingredient is required" };
  }
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return { valid: false, error: "At least one step is required" };
  }

  const ingredients: IngredientInput[] = [];
  for (const item of obj.ingredients) {
    if (typeof item !== "object" || item === null) {
      return { valid: false, error: "Ingredient must be an object" };
    }
    const ingredient = item as Record<string, unknown>;
    const name = typeof ingredient.name === "string" ? ingredient.name.trim() : "";
    const amount = Number(ingredient.amount);
    const unit = typeof ingredient.unit === "string" ? ingredient.unit.trim() : "";
    if (!name || !Number.isFinite(amount) || amount <= 0 || !unit) {
      return { valid: false, error: "Ingredient fields are invalid" };
    }
    ingredients.push({ name, amount, unit });
  }

  const steps: string[] = [];
  for (const item of obj.steps) {
    const step = typeof item === "string" ? item.trim() : "";
    if (!step) {
      return { valid: false, error: "Step text cannot be empty" };
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
      description: typeof obj.description === "string" ? obj.description.trim() : "",
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

async function insertIngredients(client: import("pg").PoolClient, recipeId: number, items: IngredientInput[]) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    await client.query(
      `
      INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, position)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [recipeId, item.name, item.amount, item.unit, index]
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
