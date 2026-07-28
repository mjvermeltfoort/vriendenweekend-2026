import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputPath = resolve(process.argv[2] ?? 'config.js');
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'SUPABASE_URL en SUPABASE_PUBLISHABLE_KEY moeten als GitHub Actions Variables zijn ingesteld.'
  );
}

const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== 'https:') {
  throw new Error('SUPABASE_URL moet een geldige HTTPS-URL zijn.');
}

const config = {
  supabaseUrl,
  supabasePublishableKey,
  localDevMode: false
};

await writeFile(
  outputPath,
  `window.VRIENDENWEEKEND_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
  'utf8'
);
