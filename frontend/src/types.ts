export type RecipeListItem = {
  id: number;
  title: string;
  description: string;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  photoUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Ingredient = {
  name: string;
  amount: number;
  unit: string;
};

export type RecipeDetail = {
  id: number;
  title: string;
  description: string;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  photoUrl: string | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type RecipePayload = {
  title: string;
  description: string;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  photoUrl: string | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
};
