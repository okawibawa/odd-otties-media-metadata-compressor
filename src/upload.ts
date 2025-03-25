import { $ } from "bun";
import fs from "fs/promises";
import path from "path";
import pLimit from "p-limit";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

const log = (msg: string) => console.log(`[INFO] ${msg}`);

const getConfig = (): R2Config => {
  const config = {
    accountId: Bun.env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: Bun.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: Bun.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucketName: Bun.env.CLOUDFLARE_R2_BUCKET_NAME,
  };

  const missingVars = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
  }

  return config as R2Config;
};

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${getConfig().accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: getConfig().accessKeyId,
    secretAccessKey: getConfig().secretAccessKey,
  },
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const uploadFiles = async (): Promise<void> => {
  try {
    const config = getConfig();
    const OUTPUT_DIR = path.resolve(import.meta.dir, "..", "output");
    const CONCURRENCY_LIMIT = 2;
    const REQUEST_DELAY_MS = 800;

    const files = await fs.readdir(OUTPUT_DIR);
    const webpFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".webp",
    );

    if (webpFiles.length === 0) {
      log("No WebP files found to upload");
      return;
    }

    log(`Found ${webpFiles.length} WebP files to upload`);

    const limit = pLimit(CONCURRENCY_LIMIT);

    const uploadPromises = webpFiles.map((file, index) =>
      limit(async () => {
        const filePath = path.join(OUTPUT_DIR, file);

        if (index > 0) {
          log(`Delaying upload: ${file}`);
          await delay(REQUEST_DELAY_MS);
        }

        try {
          log(`Uplading: ${file}`);

          await fs.access(filePath, fs.constants.R_OK);

          const fileContent = await fs.readFile(filePath);

          await S3.send(
            new PutObjectCommand({
              Bucket: "otties",
              Body: fileContent,
              Key: file,
              ContentType: "image/webp",
            }),
          );

          log(`Successfully uploaded: ${file}`);
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error(`Failed to upload ${file}:`, error.message);
          }

          console.error(`Failed to upload ${file}:`, JSON.stringify(error));

          throw error;
        }
      }),
    );

    await Promise.all(uploadPromises);
    log("Upload process completed successfully");
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error in upload process:`, error.message);
    }

    console.error(`Error in upload process:`, JSON.stringify(error));

    process.exit(1);
  }
};

uploadFiles().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
