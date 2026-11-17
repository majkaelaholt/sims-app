# SimStory Studio v4.4 — Grocery Planner update

## Grocery Planner (new)

Choose meals from the recipe shelf, set how many times you plan to cook each, and get one consolidated grocery list. Features:
- 103 starter recipes and 8 stand-mixer prep ingredients, using recipe lists from Sims Community and The Sims Wiki as reference material
- Automatically expand prepared ingredients into raw ingredients with the correct mixer batch yield (5 portions per batch)
- Two cooking modes: raw ingredients / prepped ingredients
- Use saved meal collections, favorites, searchable categories, and built-in menu ideas
- Track what is in your pantry, check off purchased items, copy/download or print the list
- Save custom recipes and prep components; edit built-in recipes to match your game
- Your SimStory Studio JSON export/import now includes grocery planner data
- One-time ownership setup: all cataloged packs except Enchanted by Nature, Adventure Awaits, and Royalty & Legacy

**Important:** This is a planning guide, not a complete authoritative database of all Sims 4 recipes. Ingredients may differ by pack combination, game version, serving sizes, or gameplay mods. If a recipe lists alternatives (e.g., “Milk or Egg”), the starter catalog uses one example; you can edit it. A cooking batch is not the same as an individual serving. Check the in-game cooking menu when accuracy matters.

## Changed files from v4.3
Upload only these changed/new files to the root of your GitHub Pages repository:
- `index.html` — includes the new CSS and JS
- `app.js` — adds navigation, pack ownership update, persistent grocery state, export/import
- `grocery.css` — new Grocery Planner styling
- `grocery.js` — new planner interface and calculation engine
- `grocery-data.js` — new recipe and prep ingredients data
- `README.md` — notes/documentation (optional to deploy)

No assets/icons files are changed by the grocery feature. The full ZIP includes the existing icons so it can also be deployed from scratch.

## License / source notes
Unofficial Sims fan project. Gameplay art © Electronic Arts / Maxis. Bundled graphic icons from the user's Build-A-Sim and Builder's icon pack uploads by deathbypufferfish, plus user's Soul's Journey icon. Recipe references: https://simscommunity.info/2023/10/19/ultimate-sims-4-recipe-list/ and https://sims.fandom.com/wiki/Cooking_(The_Sims_4).


## v4.5 — In-game serving-size recipes

- Choose Single (×1), Family (×4), or Party (×8) independently for meals that support those sizes; pizza/waffles and designated group meals only show Party.
- Ingredient quantities are distinct per serving size: **never multiplied by four or eight**.
- Sixteen common dishes have checked size-specific ingredient profiles from the Sims Wiki. Other sizes without verified requirements are visibly flagged and excluded from grocery totals until edited (instead of guessed).
- Each recipe has a size-aware editor (plus an optional prepared-ingredient alternative per size).
- Meal collections and JSON backups preserve the selected serving size; older plans safely default to the recipe's normal size.
