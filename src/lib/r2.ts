import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface UploadResult {
    success: boolean;
    url?: string;
    key?: string;
    error?: string;
}

export async function uploadToR2(
    file: File,
    folder: string = "uploads",
): Promise<UploadResult> {
    try {
        const { env } = await getCloudflareContext();

        // 1. Check if the R2 bucket binding exists
        if (!env.next_cf_app_bucket) {
             console.error("R2 upload error: R2 bucket binding 'next_cf_app_bucket' not found.");
             return {
                success: false,
                error: "Server configuration error: R2 bucket is not bound.",
             };
        }

        // 2. Check if the R2 public URL is configured
        const r2PublicUrl = (env as any).CLOUDFLARE_R2_URL as string;
        if (!r2PublicUrl) {
            console.error("R2 upload error: CLOUDFLARE_R2_URL environment variable is not set.");
            return {
                success: false,
                error: "Server configuration error: R2 public URL is not set.",
            };
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const extension = file.name.split(".").pop() || "bin";
        const key = `${folder}/${timestamp}_${randomId}.${extension}`;

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Upload to R2
        await env.next_cf_app_bucket.put(key, arrayBuffer, {
            httpMetadata: {
                contentType: file.type,
                cacheControl: "public, max-age=31536000", // 1 year
            },
            customMetadata: {
                originalName: file.name,
                uploadedAt: new Date().toISOString(),
                size: file.size.toString(),
            },
        });

        // 3. Safely construct the public URL
        let finalUrl = r2PublicUrl;
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = `https://${finalUrl}`;
        }
        if (finalUrl.endsWith('/')) {
            finalUrl = finalUrl.slice(0, -1);
        }

        return {
            success: true,
            url: `${finalUrl}/${key}`,
            key: key,
        };
    } catch (error) {
        console.error("R2 upload error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
        };
    }
}

export async function getFromR2(key: string): Promise<R2Object | null> {
    try {
        const { env } = await getCloudflareContext();
        return env.next_cf_app_bucket.get(key);
    } catch (error) {
        console.error("Error getting data from R2", error);
        return null;
    }
}

export async function listR2Files() {}
