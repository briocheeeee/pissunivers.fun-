import fs from 'fs';
import path from 'path';

const EMOJIS_DIR = path.resolve(process.cwd(), 'public', 'emojis');
const ALLOWED_EXTENSIONS = ['.gif', '.jpg', '.jpeg'];

let cachedEmojis = null;
let cacheTime = 0;
const CACHE_DURATION = 60000;

function getEmojis() {
  const now = Date.now();
  if (cachedEmojis && now - cacheTime < CACHE_DURATION) {
    return cachedEmojis;
  }

  try {
    if (!fs.existsSync(EMOJIS_DIR)) {
      fs.mkdirSync(EMOJIS_DIR, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(EMOJIS_DIR);
    const emojis = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      })
      .map((file) => {
        const ext = path.extname(file);
        const name = path.basename(file, ext);
        return {
          name,
          filename: file,
          ext: ext.substring(1),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    cachedEmojis = emojis;
    cacheTime = now;
    return emojis;
  } catch (error) {
    console.error('Error reading emojis directory:', error);
    return [];
  }
}

export default (req, res) => {
  const emojis = getEmojis();
  res.json({ emojis, count: emojis.length });
};
