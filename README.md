# CE Fun Club Links

A link page for the CE Fun Club Store that you can install like an app. Anyone with the URL can see the links. Owners sign in and edit them, and changes reach every open phone and computer right away through Supabase.

- **Cloud sync:** the page name, logo and links are stored in Supabase. When someone saves, every open copy updates live.
- **Owner-only editing:** owners sign in with an email link. Only emails on the `editors` list can change anything, and the database rules enforce this too.
- **Photos:** logos and tile photos are cropped to squares, shrunk, and uploaded to Supabase Storage.
- **Safe saves:** if two people edit at the same time, the second save is stopped. That person is asked to load the newer version first, so no one's changes get overwritten.
- **Installable and works offline:** you can add it to your home screen, and it still shows the last links when there's no connection.

## Set up Supabase (about 5 minutes)

You don't need a new project. This app can share a Supabase project you already have. Its tables, its storage bucket and its function all start with `ce_`, so they won't clash with your other app.

1. Open the existing project. Go to **SQL Editor → New query**, paste in all of [`supabase/schema.sql`](supabase/schema.sql), and run it.
2. Add yourself (and any other owners) as editors:
   ```sql
   insert into public.ce_editors (email) values ('you@example.com');
   ```
3. Make sure each owner has a user account in this project. Go to **Authentication → Users → Add user → Send invitation**, or skip this if they already use your other app with that email. This app won't create new accounts, so strangers can't use it to sign up to your other app.
4. Go to **Authentication → URL Configuration**. Add the address where this app will be hosted (for example `https://ce-links.vercel.app`) under **Redirect URLs**. Leave **Site URL** alone, because your other app uses it. If you test locally, also add `http://localhost:8000`.
5. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key into [`config.js`](config.js).

The anon key is safe to make public. What stops other people from editing is the row-level security rules in `schema.sql`.

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
| `app.js` | UI, editing, Supabase sync, sign-in and image upload |
| `styles.css` | Styles, in light and dark mode |
| `config.js` | Supabase URL and anon key |
| `sw.js`, `manifest.webmanifest`, `icons/` | Install and offline support |
| `supabase/schema.sql` | Tables, security rules, realtime, storage bucket and starting content |

To run more than one link page from the same project, give each one its own `pageId` in `config.js` and insert a matching row into `link_pages`.
