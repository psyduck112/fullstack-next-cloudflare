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

        if (!env.next_cf_app_bucket) {
             console.error("R2 upload error: R2 bucket binding 'next_cf_app_bucket' not found.");
             return {
                success: false,
                error: "Server configuration error: R2 bucket is not bound.",
             };
        }

        const r2PublicUrl = (env as any).CLOUDFLARE_R2_URL as string;
        if (!r2PublicUrl) {
            console.error("R2 upload error: CLOUDFLARE_R2_URL environment variable is not set.");
            return {
                success: false,
                error: "Server configuration error: R2 public URL is not set.",
            };
        }

        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const extension = file.name.split(".").pop() || "bin";
        const key = `${folder}/${timestamp}_${randomId}.${extension}`;

        const arrayBuffer = await file.arrayBuffer();

        await env.next_cf_app_bucket.put(key, arrayBuffer, {
            httpMetadata: {
                contentType: file.type,
                cacheControl: "public, max-age=31536000",
            },
            customMetadata: {
                originalName: file.name,
                uploadedAt: new Date().toISOString(),
                size: file.size.toString(),
            },
        });

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

// --- 新增的函数 ---
export async function deleteFromR2(
    key: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const { env } = await getCloudflareContext();

        if (!env.next_cf_app_bucket) {
            console.error("R2 delete error: R2 bucket binding 'next_cf_app_bucket' not found.");
            return {
                success: false,
                error: "Server configuration error: R2 bucket is not bound.",
            };
        }

        await env.next_cf_app_bucket.delete(key);
        console.log(`Successfully deleted R2 object: ${key}`);
        return { success: true };
    } catch (error) {
        console.error("R2 delete error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Delete from R2 failed",
        };
    }
}
