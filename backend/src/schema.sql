CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Другое',
  description TEXT DEFAULT '',
  servings INTEGER DEFAULT 1,
  prep_time_min INTEGER DEFAULT 0,
  cook_time_min INTEGER DEFAULT 0,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS meal_category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS main_ingredient TEXT;

UPDATE recipes
SET category = 'Другое'
WHERE category IS NULL OR btrim(category) = '';

ALTER TABLE recipes
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'Другое';

UPDATE recipes
SET main_ingredient = category
WHERE (main_ingredient IS NULL OR btrim(main_ingredient) = '')
  AND category IS NOT NULL
  AND btrim(category) <> '';

UPDATE recipes
SET meal_category = CASE
  WHEN lower(title) LIKE '%завтрак%' THEN 'Завтрак'
  WHEN lower(title) LIKE '%каша%' THEN 'Завтрак'
  WHEN lower(title) LIKE '%омлет%' THEN 'Завтрак'
  WHEN lower(title) LIKE '%десерт%' THEN 'Десерт'
  WHEN lower(title) LIKE '%торт%' THEN 'Десерт'
  WHEN lower(title) LIKE '%пирог%' THEN 'Десерт'
  WHEN lower(title) LIKE '%суп%' THEN 'Обед'
  ELSE 'Ужин'
END
WHERE meal_category IS NULL OR btrim(meal_category) = '';

UPDATE recipes
SET subcategory = CASE
  WHEN lower(title) LIKE '%котлет%' THEN 'Котлеты'
  WHEN lower(title) LIKE '%салат%' THEN 'Салат'
  WHEN lower(title) LIKE '%суп%' THEN 'Суп'
  WHEN lower(title) LIKE '%пирог%' THEN 'Пирог'
  WHEN lower(title) LIKE '%ребр%' THEN 'Ребра'
  ELSE 'Другое'
END
WHERE subcategory IS NULL OR btrim(subcategory) = '';

UPDATE recipes
SET main_ingredient = 'Другое'
WHERE main_ingredient IS NULL OR btrim(main_ingredient) = '';

ALTER TABLE recipes
  ALTER COLUMN meal_category SET NOT NULL,
  ALTER COLUMN meal_category SET DEFAULT 'Ужин',
  ALTER COLUMN subcategory SET NOT NULL,
  ALTER COLUMN subcategory SET DEFAULT 'Другое',
  ALTER COLUMN main_ingredient SET NOT NULL,
  ALTER COLUMN main_ingredient SET DEFAULT 'Другое';

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'Основное',
  name TEXT NOT NULL,
  amount TEXT NOT NULL,
  unit TEXT NOT NULL,
  position INTEGER NOT NULL
);

ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS section TEXT;

UPDATE recipe_ingredients
SET section = 'Основное'
WHERE section IS NULL OR btrim(section) = '';

ALTER TABLE recipe_ingredients
  ALTER COLUMN section SET NOT NULL,
  ALTER COLUMN section SET DEFAULT 'Основное';

ALTER TABLE recipe_ingredients
  ALTER COLUMN amount TYPE TEXT USING amount::text;

CREATE TABLE IF NOT EXISTS recipe_steps (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_text TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recipe_tags (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subcategories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredients_catalog (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO categories (name)
SELECT DISTINCT btrim(category)
FROM recipes
WHERE btrim(category) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO meal_categories (name)
VALUES ('Завтрак'), ('Обед'), ('Ужин'), ('Десерт')
ON CONFLICT DO NOTHING;

INSERT INTO subcategories (name)
VALUES ('Котлеты'), ('Салат'), ('Суп'), ('Пирог'), ('Ребра'), ('Другое')
ON CONFLICT DO NOTHING;

INSERT INTO meal_categories (name)
SELECT DISTINCT btrim(meal_category)
FROM recipes
WHERE btrim(meal_category) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO subcategories (name)
SELECT DISTINCT btrim(subcategory)
FROM recipes
WHERE btrim(subcategory) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO categories (name)
SELECT DISTINCT btrim(main_ingredient)
FROM recipes
WHERE btrim(main_ingredient) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO ingredients_catalog (name)
SELECT DISTINCT btrim(name)
FROM recipe_ingredients
WHERE btrim(name) <> ''
ON CONFLICT DO NOTHING;

DELETE FROM categories c
USING categories d
WHERE lower(c.name) = lower(d.name) AND c.id > d.id;

DELETE FROM ingredients_catalog c
USING ingredients_catalog d
WHERE lower(c.name) = lower(d.name) AND c.id > d.id;

DELETE FROM meal_categories c
USING meal_categories d
WHERE lower(c.name) = lower(d.name) AND c.id > d.id;

DELETE FROM subcategories c
USING subcategories d
WHERE lower(c.name) = lower(d.name) AND c.id > d.id;

CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes USING GIN (to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_dates ON meal_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_recipe_id ON meal_plans(recipe_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique ON categories ((lower(name)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_catalog_name_unique ON ingredients_catalog ((lower(name)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_categories_name_unique ON meal_categories ((lower(name)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_subcategories_name_unique ON subcategories ((lower(name)));
CREATE INDEX IF NOT EXISTS idx_recipes_meal_category ON recipes(meal_category);
CREATE INDEX IF NOT EXISTS idx_recipes_subcategory ON recipes(subcategory);
CREATE INDEX IF NOT EXISTS idx_recipes_main_ingredient ON recipes(main_ingredient);