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

UPDATE recipes
SET category = 'Другое'
WHERE category IS NULL OR btrim(category) = '';

ALTER TABLE recipes
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'Другое';

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

CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes USING GIN (to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
