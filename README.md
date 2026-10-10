# CE Fun Club Links

A link page for the CE Fun Club Store that you can install like an app. Anyone with the URL can see the links. Anyone with the edit code can change them, no account needed, and changes reach every open phone and computer right away through Supabase.

- **Cloud sync:** the page name, logo and links are stored in Supabase. When someone saves, every open copy updates live.
- **Edit code, no accounts:** anyone can view the page. To change it, tap **Edit links** at the bottom and enter your edit code. Each device can remember the code, so you only type it once. Supabase checks the code itself, and 10 wrong tries lock editing for 15 minutes.
- **Photos:** logos and tile photos are cropped to squares, shrunk, and saved with the page.
- **Safe saves:** if two people edit at the same time, the second save is stopped. That person is asked to load the newer version first, so no one's changes get overwritten.
- **Installable and works offline:** you can add it to your home screen, and it still shows the last links when there's no connection.

## Set up Supabase (about 5 minutes)

You don't need a new project. This app can share a Supabase project you already have. Everything it adds to the database starts with `ce_`, so it won't clash with your other app. It doesn't use Supabase sign-in, so it won't affect your other app's users either.

1. Open the existing project. Go to **SQL Editor → New query**, paste in all of [`supabase/schema.sql`](supabase/schema.sql), and run it.
2. Set your edit code. Replace `CHANGE-ME` with your own code, then run:
   ```sql
   insert into public.ce_edit_codes (page_id, code_hash)
   values ('main', extensions.crypt('CHANGE-ME', extensions.gen_salt('bf')))
   on conflict (page_id) do update set code_hash = excluded.code_hash, failed_attempts = 0;
   ```
   Use something longer than a 4-digit PIN, like `green-mango-42`. To change the code later, run the same lines again with the new code. Devices that remembered the old code will be asked for the new one the next time they save.
3. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key into [`config.js`](config.js).

The anon key is safe to make public. The page can only be changed through a database function that checks the edit code.

If `config.js` still has the placeholders, the app runs in local-only mode. Anyone can edit, but changes stay on that one device.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

The app is plain static files and needs no build step. Any static host works:

- **Vercel:** import the repo and deploy with the default settings.
- **Netlify:** drag the folder into Netlify Drop, or connect the repo.
- **GitHub Pages:** Settings → Pages → deploy from the branch root.

After deploying, make sure the live URL is listed under the Supabase redirect URLs (step 4).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell |
| `app.js` | UI, editing, edit code, Supabase sync and photos |
| `styles.css` | Styles, in light and dark mode |
| `config.js` | Supabase URL and anon key |
| `sw.js`, `manifest.webmanifest`, `icons/` | Install and offline support |
| `supabase/schema.sql` | Tables, security rules, edit-code check, realtime and starting content |

To run more than one link page from the same project, give each one its own `pageId` in `config.js` and set an edit code for that page ID (step 2, using the new ID instead of `main`). The page is created on its first save.
