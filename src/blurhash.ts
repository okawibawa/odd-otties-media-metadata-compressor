import { getBase64 } from "@plaiceholder/base64";
import { readdir } from "fs/promises";
import { join } from "path";
import path from "path";

const IMAGES_DIR = path.resolve(import.meta.dir, "..", "output");
const OUTPUT_FILE = path.resolve(import.meta.dir, "..", "blurhash.json");

async function generatePlaceholders() {
  const placeholders: { [key: string]: string | null } = {};

  try {
    const files = await readdir(IMAGES_DIR);
    const imageFiles = files.filter((file) => file.endsWith(".webp"));

    for (const file of imageFiles) {
      const filePath = join(IMAGES_DIR, file);
      const imageName = file.replace(".webp", "");

      try {
        const buffer = await Bun.file(filePath).arrayBuffer();
        const imageBuffer = Buffer.from(buffer);

        const placeholder = await getBase64(imageBuffer);
        placeholders[imageName] = placeholder;
        console.log(`Generated placeholder for ${file}`);
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
        placeholders[imageName] = null;
      }
    }

    await Bun.write(OUTPUT_FILE, JSON.stringify(placeholders, null, 2));
    console.log("Placeholders saved to placeholders.json");
  } catch (err) {
    console.error("Error reading images directory:", err);
  }
}

generatePlaceholders().catch((err) => console.error("Error:", err));
