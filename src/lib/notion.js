import recipeData from '../data/recipes.json';

export async function getRecipes() {
  return recipeData.recipes ?? [];
}

export async function getRecipePage(pageId) {
  const slug = pageId.replace(/-/g, '');
  const recipe = recipeData.recipes?.find(r => r.slug === slug);
  const blocks = recipeData.pages?.[slug] ?? [];
  return { recipe: recipe ?? null, blocks };
}
