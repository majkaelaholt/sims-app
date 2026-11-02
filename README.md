# SimStory Studio v4.2 — Hobby icon alignment

Your Sims 4 idea generator now bundles **real icon PNG files from your uploaded Build-A-Sim Icon Pack [deathbypufferfish]**. There is **no need for a wiki connection or manual icon import**.

## Start

- **Standalone HTML:** Download `SimStory-Studio-v4.2.html` and open it in a browser. The PNGs are embedded as data URIs and work completely offline.
- **GitHub Pages:** Extract `SimStory-Studio-v4.2-GitHub-Pages.zip`, upload all files/folders to your repository, and open the GitHub Pages site. **Upload the assets folder** along with the code; it stores the PNG files.

## Included

Original named icon files for main traits, aspirations, skills, and careers (including useful career branches). The downloaded ZIP originally also contained thousands of secondary items such as buffs, pet traits, sentiments, and milestones; this build deliberately focuses on the four categories used by the character generator rather than bundling those extras. The source ZIP is not needed for normal use.

All 61 aspirations offered in the app now have matching bundled icons, including Soul's Journey from the separately supplied `souls_journey.webp`. Some other unused names may still have no icon; those display a clear placeholder instead of an unrelated image. `bundled-icons.js` maps names to files.

## Other functions

Pack toggles, locked character choices, custom colors, generated backstories, skill priorities, roommate builder, Inspo Deck, decision dice, the saved idea library, and JSON import/export are all retained from v3.

## Existing saves

Local storage key is unchanged: `simstory-studio-v1`. Back up your saved ideas in v3 (Saved Ideas → Export) before replacing it, especially if using a different URL.

## Credits

Images from user-provided **Build-A-Sim Icon Pack by deathbypufferfish** and separate **Soul’s Journey** upload (converted from WebP to PNG). Sims artwork, character icons, and trademarks belong to Electronic Arts / Maxis and their applicable rights holders. This unofficial fan project is not affiliated with or endorsed by EA. Images are bundled for the user's personal fan project. The creator's original collection is not redistributed in its entirety.

## v4.2 — Hobby icon fix

Hobbies using learnable skills now display the corresponding bundled skill PNG. For example, the Knitting hobby uses `skill|Knitting`, exactly the same image used by Skills to grow or master. Different hobby phrasing such as "Making nectar" and "Playing piano" is handled by an intentional name-to-skill lookup. A hobby with no correct skill icon stays labeled rather than displaying unrelated artwork. No changes to saved idea formats.


## v4.3 visual update

- Added pack-library icons from the uploaded **Builder’s Icon Pack [deathbypufferfish]**
- Added pack, venue, lot-trait, lot-challenge, tiny-home, and apartment-trait icons to the icon library
- Reused Sims icons in a few UI spots for a more cohesive look
